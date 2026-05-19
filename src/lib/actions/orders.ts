"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createOrderPayloadSchema,
  modifyOrderPayloadSchema,
  type OrderStatus,
} from "@/lib/validations/order";
import { VARIATION_PUBLIC_COLUMNS } from "@/lib/utils";
import { evaluateCreditForCommitment } from "@/lib/data/credit-exposure";
import { writeAuditLog } from "@/lib/data/audit-log";

export type CreateOrderResult = {
  orderId: string | null;
  error: string | null;
  errorKey?: string | null;
  errorParams?: Record<string, string | number> | null;
  warnings: string[];
  /** Soft credit warning when trade terms use warn mode */
  creditWarning?: {
    messageKey: "creditLimitExceeded";
    params: Record<string, string | number>;
  };
};

export async function createOrder(
  cartItems: unknown,
  supplierId: string,
  notes?: string,
  options?: { isCod?: boolean }
): Promise<CreateOrderResult> {
  const parsed = createOrderPayloadSchema.safeParse({
    items: cartItems,
    supplierId,
    notes: notes ?? "",
    isCod: !!options?.isCod,
  });
  if (!parsed.success)
    return { orderId: null, error: parsed.error.message, warnings: [] };

  const { items, supplierId: sid, notes: orderNotes, isCod } = parsed.data;
  if (items.some((i) => i.supplierId !== sid)) {
    return { orderId: null, error: "Cart supplier mismatch", warnings: [] };
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orderId: null, error: "Unauthorized", warnings: [] };

  const { data: roleRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "retailer")
    return {
      orderId: null,
      error: "Only retailers can place orders",
      warnings: [],
    };

  const variationIds = [...new Set(items.map((i) => i.variationId))];

  const { data: variations, error: vFetchErr } = await supabase
    .from("product_variations")
    .select(VARIATION_PUBLIC_COLUMNS)
    .in("id", variationIds);

  if (vFetchErr || !variations?.length) {
    return {
      orderId: null,
      error: vFetchErr?.message ?? "Could not load product variations",
      warnings: [],
    };
  }

  const varMap = new Map(variations.map((v) => [v.id, v]));
  const productIds = [...new Set(variations.map((v) => v.product_id))];

  const { data: products, error: pFetchErr } = await supabase
    .from("products")
    .select("id, name, supplier_id, is_active")
    .in("id", productIds);

  if (pFetchErr || !products?.length) {
    return {
      orderId: null,
      error: pFetchErr?.message ?? "Could not load products",
      warnings: [],
    };
  }

  const prodMap = new Map(products.map((p) => [p.id, p]));

  const warnings: string[] = [];
  let total = 0;

  type Line = {
    product_id: string;
    variation_id: string | null;
    product_name: string;
    variation_name: string | null;
    quantity: number;
    unit_price: number;
  };

  const lines: Line[] = [];

  for (const item of items) {
    const v = varMap.get(item.variationId);
    if (!v || !v.is_active) {
      return {
        orderId: null,
        error: `Invalid or inactive variation: ${item.variationId}`,
        warnings: [],
      };
    }

    const product = prodMap.get(v.product_id);
    if (!product || !product.is_active) {
      return {
        orderId: null,
        error: `Product unavailable: ${item.productId}`,
        warnings: [],
      };
    }

    if (product.supplier_id !== sid) {
      return {
        orderId: null,
        error: "Product does not belong to this supplier",
        warnings: [],
      };
    }
    if (product.id !== item.productId) {
      return {
        orderId: null,
        error: "Product mismatch for variation",
        warnings: [],
      };
    }

    const qty = item.quantity;
    const minOrder = Number(v.min_order_quantity);
    const stock = Number(v.stock_quantity);
    const unitPrice = Number(v.price);

    if (qty < minOrder) {
      return {
        orderId: null,
        error: `${product.name} / ${v.name}: quantity must be at least ${minOrder}`,
        warnings: [],
      };
    }

    if (qty > stock) {
      warnings.push(
        `${product.name} / ${v.name}: ordered ${qty} but only ${stock} in stock (order still placed).`
      );
    }

    total += unitPrice * qty;
    lines.push({
      product_id: product.id,
      variation_id: v.id,
      product_name: product.name,
      variation_name: v.name,
      quantity: qty,
      unit_price: unitPrice,
    });
  }

  const orderTotalRounded = Math.round(total * 100) / 100;
  const creditGate = await evaluateCreditForCommitment(supabase, {
    supplierId: sid,
    retailerId: user.id,
    candidateOrderTotal: orderTotalRounded,
  });
  if (!creditGate.ok) {
    return {
      orderId: null,
      error: creditGate.message,
      errorKey: creditGate.messageKey,
      errorParams: creditGate.params ?? null,
      warnings: [],
    };
  }
  const creditWarning = creditGate.creditWarning;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      retailer_id: user.id,
      supplier_id: sid,
      status: "pending",
      total_price: orderTotalRounded,
      notes: orderNotes || null,
      is_cod: !!isCod,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return {
      orderId: null,
      error: orderError?.message ?? "Failed to create order",
      warnings: [],
    };
  }

  const orderItems = lines.map((l) => ({
    order_id: order.id,
    product_id: l.product_id,
    variation_id: l.variation_id,
    product_name: l.product_name,
    variation_name: l.variation_name,
    quantity: l.quantity,
    unit_price: l.unit_price,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { orderId: null, error: itemsError.message, warnings: [] };
  }

  const { data: supplierRow } = await supabase
    .from("suppliers")
    .select("user_id")
    .eq("id", sid)
    .maybeSingle();

  if (supplierRow?.user_id) {
    try {
      const admin = supabaseAdmin();
      await admin.from("notifications").insert({
        user_id: supplierRow.user_id,
        type: "new_order",
        title: "New order",
        message: "You have received a new order.",
        title_key: "newOrder.title",
        message_key: "newOrder.message",
        params: { orderId: order.id },
        reference_id: order.id,
        reference_type: "order",
      });
    } catch {
      // best-effort
    }
  }

  revalidatePath("/retailer/orders");
  revalidatePath("/supplier/orders");
  return { orderId: order.id, error: null, warnings, creditWarning };
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/retailer/orders");
  revalidatePath(`/retailer/orders/${orderId}`);
  revalidatePath("/supplier/orders");
  revalidatePath(`/supplier/orders/${orderId}`);
}

async function notifyUser(
  userId: string,
  payload: {
    type: "new_order" | "order_updated";
    title: string;
    message: string;
    referenceId: string;
    titleKey?: string;
    messageKey?: string;
    params?: Record<string, string | number>;
  }
) {
  try {
    const admin = supabaseAdmin();
    await admin.from("notifications").insert({
      user_id: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      title_key: payload.titleKey ?? null,
      message_key: payload.messageKey ?? null,
      params: payload.params ?? {},
      reference_id: payload.referenceId,
      reference_type: "order",
    });
  } catch {
    // best-effort
  }
}

export async function acceptOrder(
  orderId: string
): Promise<{ error: string | null; errorKey?: string | null; errorParams?: Record<string, string | number> | null }> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!supplier) return { error: "Only suppliers can accept orders" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, supplier_id, status, retailer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order)
    return { error: orderErr?.message ?? "Order not found" };
  if (order.supplier_id !== supplier.id) return { error: "Forbidden" };
  if (order.status !== "pending")
    return { error: "Only pending orders can be accepted" };

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("id, quantity, variation_id")
    .eq("order_id", orderId);

  if (itemsErr || !items?.length)
    return { error: itemsErr?.message ?? "No line items" };

  const variationIds = items
    .map((i) => i.variation_id)
    .filter(Boolean) as string[];
  const { data: vars, error: vErr } = await supabase
    .from("product_variations")
    .select("id, stock_quantity")
    .in("id", variationIds);

  if (vErr || !vars?.length)
    return { error: vErr?.message ?? "Could not verify stock" };

  const stockMap = new Map(vars.map((v) => [v.id, Number(v.stock_quantity)]));
  for (const line of items) {
    if (!line.variation_id) continue;
    const stock = stockMap.get(line.variation_id);
    if (stock === undefined)
      return { error: "Invalid variation on order line" };
    if (line.quantity > stock) {
      return {
        error: `Insufficient stock for one or more items (need ${line.quantity}, have ${stock}).`,
        errorKey: 'insufficientStock',
        errorParams: { need: line.quantity, have: stock },
      };
    }
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");

  if (updErr) return { error: updErr.message };

  await notifyUser(order.retailer_id, {
    type: "order_updated",
    title: "Order accepted",
    message: "Your order has been accepted and is being prepared.",
    titleKey: "orderAccepted.title",
    messageKey: "orderAccepted.message",
    referenceId: orderId,
  });

  await writeAuditLog({
    actorId: user.id,
    eventType: "order_accepted",
    orderId,
    metadata: { from_status: "pending", to_status: "accepted" },
  });

  revalidateOrderPaths(orderId);
  return { error: null, errorKey: null, errorParams: null };
}

export async function rejectOrder(
  orderId: string
): Promise<{ error: string | null }> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!supplier) return { error: "Only suppliers can reject orders" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, supplier_id, status, retailer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order)
    return { error: orderErr?.message ?? "Order not found" };
  if (order.supplier_id !== supplier.id) return { error: "Forbidden" };
  if (order.status !== "pending")
    return { error: "Only pending orders can be rejected" };

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");

  if (updErr) return { error: updErr.message };

  await notifyUser(order.retailer_id, {
    type: "order_updated",
    title: "Order rejected",
    message: "The supplier could not fulfil this order.",
    titleKey: "orderRejected.title",
    messageKey: "orderRejected.message",
    referenceId: orderId,
  });

  await writeAuditLog({
    actorId: user.id,
    eventType: "order_rejected",
    orderId,
    metadata: { from_status: "pending", to_status: "rejected" },
  });

  revalidateOrderPaths(orderId);
  return { error: null };
}

export async function modifyOrder(
  payload: unknown
): Promise<{ error: string | null }> {
  const parsed = modifyOrderPayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.message };

  const { orderId, lines } = parsed.data;

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!supplier) return { error: "Only suppliers can modify orders" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, supplier_id, status, retailer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order)
    return { error: orderErr?.message ?? "Order not found" };
  if (order.supplier_id !== supplier.id) return { error: "Forbidden" };
  if (order.status !== "pending")
    return { error: "Only pending orders can be modified" };

  const newTotal =
    Math.round(
      lines.reduce((s, line) => s + line.quantity * line.unitPrice, 0) * 100
    ) / 100;
  const creditGate = await evaluateCreditForCommitment(supabase, {
    supplierId: order.supplier_id,
    retailerId: order.retailer_id,
    excludeOrderId: orderId,
    candidateOrderTotal: newTotal,
  });
  if (!creditGate.ok) return { error: creditGate.message };

  const { data: existingItems, error: exErr } = await supabase
    .from("order_items")
    .select("id, quantity, unit_price, product_name, variation_name")
    .eq("order_id", orderId);

  if (exErr || !existingItems?.length)
    return { error: exErr?.message ?? "No line items" };

  const existingIds = new Set(existingItems.map((r) => r.id));
  for (const line of lines) {
    if (!existingIds.has(line.orderItemId))
      return { error: "Invalid line item" };
  }

  const oldById = new Map(existingItems.map((r) => [r.id, r]));
  const lineChanges: {
    order_item_id: string;
    product_label: string;
    old_quantity: number;
    new_quantity: number;
    old_unit_price: number;
    new_unit_price: number;
  }[] = [];

  for (const line of lines) {
    const old = oldById.get(line.orderItemId);
    if (!old) return { error: "Invalid line item" };
    const oldQty = Number(old.quantity);
    const oldPrice = Math.round(Number(old.unit_price) * 100) / 100;
    const newQty = line.quantity;
    const newPrice = Math.round(line.unitPrice * 100) / 100;
    if (oldQty !== newQty || oldPrice !== newPrice) {
      const product_label = old.variation_name
        ? `${old.product_name} (${old.variation_name})`
        : old.product_name;
      lineChanges.push({
        order_item_id: line.orderItemId,
        product_label,
        old_quantity: oldQty,
        new_quantity: newQty,
        old_unit_price: oldPrice,
        new_unit_price: newPrice,
      });
    }
  }

  for (const line of lines) {
    const { error: uErr } = await supabase
      .from("order_items")
      .update({
        quantity: line.quantity,
        unit_price: Math.round(line.unitPrice * 100) / 100,
      })
      .eq("id", line.orderItemId)
      .eq("order_id", orderId);

    if (uErr) return { error: uErr.message };
  }

  const { data: summed, error: sumErr } = await supabase
    .from("order_items")
    .select("total_price")
    .eq("order_id", orderId);

  if (sumErr || !summed)
    return { error: sumErr?.message ?? "Could not recalculate total" };

  const total =
    Math.round(summed.reduce((s, r) => s + Number(r.total_price), 0) * 100) /
    100;

  const { error: ordUpd } = await supabase
    .from("orders")
    .update({
      status: "modified",
      total_price: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (ordUpd) return { error: ordUpd.message };

  await notifyUser(order.retailer_id, {
    type: "order_updated",
    title: "Order updated",
    message:
      "The supplier proposed changes to your order. Please review and confirm.",
    titleKey: "orderModified.title",
    messageKey: "orderModified.message",
    referenceId: orderId,
  });

  if (lineChanges.length) {
    const audit = await writeAuditLog({
      actorId: user.id,
      eventType: "order_lines_modified",
      orderId,
      metadata: { lines: lineChanges },
    });
    if (audit.error) {
      // Non-fatal: order already updated; log surface only in dev if needed
    }
  }

  revalidateOrderPaths(orderId);
  return { error: null };
}

export async function advanceOrderStatus(
  orderId: string,
  next: "preparing" | "delivered"
): Promise<{ error: string | null }> {
  const allowed: Record<OrderStatus, OrderStatus | null> = {
    pending: null,
    accepted: "preparing",
    modified: null,
    rejected: null,
    preparing: null,
    shipped: "delivered",
    delivered: null,
    cancelled: null,
  };

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!supplier) return { error: "Only suppliers can update fulfilment" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, supplier_id, status, retailer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order)
    return { error: orderErr?.message ?? "Order not found" };
  if (order.supplier_id !== supplier.id) return { error: "Forbidden" };

  const current = order.status as OrderStatus;
  if (allowed[current] !== next) return { error: "Invalid status transition" };

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", current);

  if (updErr) return { error: updErr.message };

  const labels: Record<string, string> = {
    preparing: "Your order is being prepared.",
    delivered: "Your order has been delivered.",
  };
  const titleByNext: Record<string, string> = {
    preparing: "Order preparing",
    delivered: "Order delivered",
  };
  const titleKeyByNext: Record<string, string> = {
    preparing: "orderPreparing.title",
    delivered: "orderDelivered.title",
  };
  const messageKeyByNext: Record<string, string> = {
    preparing: "orderPreparing.message",
    delivered: "orderDelivered.message",
  };

  await notifyUser(order.retailer_id, {
    type: "order_updated",
    title: titleByNext[next] ?? `Order ${next}`,
    message: labels[next] ?? "Your order was updated.",
    titleKey: titleKeyByNext[next],
    messageKey: messageKeyByNext[next],
    referenceId: orderId,
  });

  await writeAuditLog({
    actorId: user.id,
    eventType: next === "preparing" ? "order_status_preparing" : "order_status_delivered",
    orderId,
    metadata: { from_status: current, to_status: next },
  });

  revalidateOrderPaths(orderId);
  return { error: null };
}

export async function cancelOrderByRetailer(
  orderId: string
): Promise<{ error: string | null }> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: roleRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "retailer")
    return { error: "Only retailers can cancel" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, retailer_id, status, supplier_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order)
    return { error: orderErr?.message ?? "Order not found" };
  if (order.retailer_id !== user.id) return { error: "Forbidden" };
  if (order.status !== "pending")
    return { error: "Only pending orders can be cancelled" };

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");

  if (updErr) return { error: updErr.message };

  const { data: supRow } = await supabase
    .from("suppliers")
    .select("user_id")
    .eq("id", order.supplier_id)
    .maybeSingle();
  if (supRow?.user_id) {
    await notifyUser(supRow.user_id, {
      type: "order_updated",
      title: "Order cancelled",
      message: "The retailer cancelled a pending order.",
      titleKey: "orderCancelledSupplier.title",
      messageKey: "orderCancelledSupplier.message",
      referenceId: orderId,
    });
  }

  await writeAuditLog({
    actorId: user.id,
    eventType: "order_cancelled_by_retailer",
    orderId,
    metadata: { from_status: "pending", to_status: "cancelled" },
  });

  revalidateOrderPaths(orderId);
  return { error: null };
}

export async function confirmModifiedOrder(
  orderId: string
): Promise<{
  error: string | null;
  errorKey?: string | null;
  errorParams?: Record<string, string | number> | null;
  creditWarning?: {
    messageKey: "creditLimitExceeded";
    params: Record<string, string | number>;
  };
}> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: roleRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "retailer")
    return { error: "Only retailers can confirm" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, retailer_id, status, supplier_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order)
    return { error: orderErr?.message ?? "Order not found" };
  if (order.retailer_id !== user.id) return { error: "Forbidden" };
  if (order.status !== "modified")
    return { error: "This order is not awaiting your confirmation" };

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("quantity, variation_id")
    .eq("order_id", orderId);

  if (itemsErr || !items?.length)
    return { error: itemsErr?.message ?? "No line items" };

  const variationIds = items
    .map((i) => i.variation_id)
    .filter(Boolean) as string[];
  const { data: vars, error: vErr } = await supabase
    .from("product_variations")
    .select("id, stock_quantity")
    .in("id", variationIds);

  if (vErr || !vars?.length)
    return { error: vErr?.message ?? "Could not verify stock" };

  const stockMap = new Map(vars.map((v) => [v.id, Number(v.stock_quantity)]));
  for (const line of items) {
    if (!line.variation_id) continue;
    const stock = stockMap.get(line.variation_id);
    if (stock === undefined)
      return { error: "Invalid variation on order line" };
    if (line.quantity > stock) {
      return {
        error: `Insufficient stock to confirm (need ${line.quantity}, have ${stock}). Contact the supplier.`,
        errorKey: 'insufficientStockConfirm',
        errorParams: { need: line.quantity, have: stock },
      };
    }
  }

  const { data: summedPre, error: sumPreErr } = await supabase
    .from("order_items")
    .select("total_price")
    .eq("order_id", orderId);

  if (sumPreErr || !summedPre?.length)
    return { error: sumPreErr?.message ?? "Could not read order total" };
  const confirmTotal =
    Math.round(summedPre.reduce((s, r) => s + Number(r.total_price), 0) * 100) /
    100;
  const creditGate = await evaluateCreditForCommitment(supabase, {
    supplierId: order.supplier_id,
    retailerId: user.id,
    excludeOrderId: orderId,
    candidateOrderTotal: confirmTotal,
  });
  if (!creditGate.ok)
    return {
      error: creditGate.message,
      errorKey: creditGate.messageKey,
      errorParams: creditGate.params ?? null,
    };

  const creditWarning = creditGate.creditWarning;

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "modified");

  if (updErr) return { error: updErr.message };

  const { data: supRow } = await supabase
    .from("suppliers")
    .select("user_id")
    .eq("id", order.supplier_id)
    .maybeSingle();
  if (supRow?.user_id) {
    await notifyUser(supRow.user_id, {
      type: "order_updated",
      title: "Order confirmed",
      message: "The retailer confirmed the updated order.",
      titleKey: "orderConfirmedSupplier.title",
      messageKey: "orderConfirmedSupplier.message",
      referenceId: orderId,
    });
  }

  await writeAuditLog({
    actorId: user.id,
    eventType: "order_modification_confirmed",
    orderId,
    metadata: { from_status: "modified", to_status: "accepted", total: confirmTotal },
  });

  revalidateOrderPaths(orderId);
  return {
    error: null,
    errorKey: null,
    errorParams: null,
    creditWarning,
  };
}
