import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrderLineItems } from "@/components/orders/order-line-items";
import { DeliveryPersonBadge } from "@/components/delivery/delivery-person-badge";
import { RetailerOrderPanel } from "@/components/orders/retailer-order-panel";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { ReorderFromDeliveredOrderButton } from "@/components/orders/reorder-from-order-button";
import { formatMoney } from "@/lib/format-money";
import { getRetailerOrderDetail } from "@/lib/data/orders";
import { getInvoiceForOrder } from "@/lib/data/invoices";
import { getOrderAuditLog } from "@/lib/data/audit-log";
import { OrderMessagesBlock } from "@/components/orders/order-messages-block";
import { OrderActivitySection } from "@/components/orders/order-activity-section";
import { SupplierChangesSummary } from "@/components/orders/supplier-changes-summary";
import { OrderReviewSection } from "@/components/reviews/order-review-section";
import { WhatsAppShareButton } from "@/components/share/whatsapp-share-button";

export default async function RetailerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("OrderDetailPage");
  const tCommon = await getTranslations("Common");
  const { id } = await params;
  const res = await getRetailerOrderDetail(id);

  if ("error" in res) {
    if (res.error === "Order not found" || res.error === "Forbidden")
      notFound();
    return (
      <p className="text-sm text-red-600">
        {tCommon("loadErrorDetails", { details: res.error })}
      </p>
    );
  }

  const { order } = res;
  const auditRes = await getOrderAuditLog(order.id);
  const audit = "error" in auditRes ? [] : auditRes;

  const invoiceForOrder =
    order.status === "delivered" ? await getInvoiceForOrder(order.id) : null;

  let existingReview: {
    overall_rating: number;
    delivery_rating: number | null;
    quality_rating: number | null;
    communication_rating: number | null;
    comment: string | null;
    created_at: string;
  } | null = null;

  if (order.status === "delivered") {
    const supabase = (await import("@/lib/supabase/server")).supabaseServer();
    const { data: review } = await supabase
      .from("supplier_reviews")
      .select(
        "overall_rating, delivery_rating, quality_rating, communication_rating, comment, created_at"
      )
      .eq("order_id", order.id)
      .maybeSingle();
    existingReview = review ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/retailer/orders"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            ← {t("backOrders")}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">
            {t("title")}
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{order.id}</p>
          <p className="mt-2 text-sm text-slate-700">
            {t("supplierLine", { name: order.supplierStore.business_name })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {order.status === "delivered" ? (
            <ReorderFromDeliveredOrderButton orderId={order.id} />
          ) : null}
          <OrderStatusBadge status={order.status} />
          <WhatsAppShareButton
            message={t("whatsappOrderMessage", {
              orderId: order.id.slice(0, 8),
              total: formatMoney(order.total_price, order.currency_code),
              counterparty: order.supplierStore.business_name,
            })}
          />
        </div>
      </div>

      {order.is_cod ? (
        <p className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
          <span className="font-semibold">{t("codBadge")}: </span>
          {t("codRetailerHint")}
        </p>
      ) : null}

      {order.status === "delivered" ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-foreground">
            {t("billingTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("retailerBillingLead")}</p>
          {invoiceForOrder ? (
            <Link
              href={`/retailer/invoices/${invoiceForOrder.id}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
            >
              {t("retailerViewInvoice", { invoice: invoiceForOrder.invoice_number })}
            </Link>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {t("retailerBillingWaiting")}
            </p>
          )}
        </section>
      ) : null}

      {order.status === "shipped" || order.status === "delivered" ? (
        <div className="space-y-2">
          {order.deliveryPerson ? (
            <DeliveryPersonBadge
              name={order.deliveryPerson.name}
              phone={order.deliveryPerson.phone}
            />
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950">
              {t("deliveryFallback")}
            </p>
          )}
        </div>
      ) : null}

      <div
        className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,380px)]"
      >
        <div
          className={
            order.status === "modified" ? "order-2 min-w-0 space-y-4 lg:order-1" : "min-w-0 space-y-4"
          }
        >
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {t("lineItems")}
            </h2>
            <OrderLineItems
              items={order.items}
              currencyCode={order.currency_code}
            />
            <div className="flex justify-end border-t border-slate-200 pt-3 text-sm">
              <span className="text-slate-600">{t("orderTotal")}</span>
              <span className="ms-4 font-semibold text-slate-900">
                {formatMoney(order.total_price, order.currency_code)}
              </span>
            </div>
          </section>

          {order.notes ? (
            <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("yourNotes")}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {order.notes}
              </p>
            </section>
          ) : null}

          <OrderMessagesBlock orderId={order.id} />
          <OrderActivitySection
            status={order.status}
            createdAt={order.created_at}
            audit={audit}
            currencyCode={order.currency_code}
          />

          {order.status === "delivered" && (
            <OrderReviewSection
              orderId={order.id}
              existingReview={existingReview}
            />
          )}

        </div>

        <div
          className={
            order.status === "modified"
              ? "order-1 min-w-0 space-y-4 lg:sticky lg:order-2 lg:top-20 lg:z-10 lg:self-start"
              : "min-w-0 space-y-4"
          }
        >
          {order.status === "modified" ? (
            <SupplierChangesSummary
              items={order.items}
              currencyCode={order.currency_code}
              newTotal={order.total_price}
              audit={audit}
              supplierName={order.supplierStore.business_name}
            />
          ) : null}
          <RetailerOrderPanel orderId={order.id} status={order.status} />
        </div>
      </div>
    </div>
  );
}
