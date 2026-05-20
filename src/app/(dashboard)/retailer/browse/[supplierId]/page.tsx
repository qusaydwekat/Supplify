import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireRequestUserId } from "@/lib/auth/request-session";
import { supabaseServer } from "@/lib/supabase/server";
import { VARIATION_PUBLIC_COLUMNS } from "@/lib/utils";
import { listStorefrontAttributeMatrix } from "@/lib/data/products/attributes";
import { tiersByVariationId } from "@/lib/pricing/resolve-unit-price";
import { StorefrontCatalog } from "@/components/retailer/storefront-catalog";
import { RatingBadge } from "@/components/reviews/rating-badge";
import { ReviewsList } from "@/components/reviews/reviews-list";
import type { StorefrontVariation } from "@/components/products/product-card";
import type { ProductAttributeRow } from "@/lib/data/products/attributes";
import type { PriceTier } from "@/lib/pricing/resolve-unit-price";
import type { MarketplaceSupplierStorefrontRow } from "@/lib/data/marketplace-suppliers";

type Pack = {
  product: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    has_variations: boolean;
  };
  variations: StorefrontVariation[];
  attributes: ProductAttributeRow[];
};

function toPack(
  product: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    has_variations: boolean;
  },
  vars: {
    id: string;
    name: string;
    price: number;
    stock_quantity: number;
    min_order_quantity: number;
  }[],
  attributes: ProductAttributeRow[],
  tierMap: Map<string, PriceTier[]>,
  variationOptionIds: Map<string, string[]>,
): Pack {
  return {
    product,
    attributes,
    variations: vars.map((v) => ({
      id: v.id,
      name: v.name,
      price: Number(v.price),
      stock_quantity: Number(v.stock_quantity),
      min_order_quantity: Number(v.min_order_quantity),
      priceTiers: tierMap.get(v.id) ?? [],
      optionIds: variationOptionIds.get(v.id) ?? [],
    })),
  };
}

export default async function RetailerSupplierStorefrontPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const t = await getTranslations("StorefrontPage");
  const tBrowse = await getTranslations("BrowsePage");
  const tCat = await getTranslations("MarketplaceCategories");
  const tReview = await getTranslations("Review");
  const { supplierId } = await params;
  const retailerId = await requireRequestUserId();
  const supabase = supabaseServer();

  const { data: supplierRows, error: sErr } = await supabase.rpc("get_marketplace_supplier", {
    p_supplier_id: supplierId,
  });

  const supplier = supplierRows?.[0] as MarketplaceSupplierStorefrontRow | undefined;

  if (sErr || !supplier || !supplier.is_active) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, city")
    .eq("user_id", supplier.user_id)
    .maybeSingle();

  const supplierLabel = profile?.business_name ?? tBrowse("supplierFallback");
  const supplierCurrency = String(supplier.currency_code ?? "USD");

  const { data: termsRow } = await supabase
    .from("retailer_supplier_terms")
    .select("blocked")
    .eq("supplier_id", supplierId)
    .eq("retailer_id", retailerId)
    .maybeSingle();

  if (termsRow?.blocked) {
    return (
      <div className="space-y-6">
        <Link
          href="/retailer/browse"
          className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
        >
          ← {t("backToBrowse")}
        </Link>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h1 className="text-xl font-semibold text-slate-900">
            {t("blockedTitle")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600">
            {supplierLabel}
          </p>
          <p className="mt-4 text-sm text-slate-700">{t("blockedBody")}</p>
        </div>
      </div>
    );
  }

  const { data: productRows } = await supabase
    .from("products")
    .select(
      "id, name, description, category, image_url, has_variations, is_active"
    )
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .eq("catalog_status", "published")
    .order("name", { ascending: true });

  const products = productRows ?? [];
  const productIds = products.map((p) => p.id);

  const { data: variationRows } =
    productIds.length > 0
      ? await supabase
          .from("product_variations")
          .select(VARIATION_PUBLIC_COLUMNS)
          .in("product_id", productIds)
          .eq("is_active", true)
      : { data: [] as never[] };

  const varsByProduct = new Map<string, typeof variationRows>();
  for (const v of variationRows ?? []) {
    const list = varsByProduct.get(v.product_id) ?? [];
    list.push(v);
    varsByProduct.set(v.product_id, list);
  }

  const allVariationIds = (variationRows ?? []).map((v) => v.id);

  const [{ data: tierRows }, attributeMatrix] = await Promise.all([
    allVariationIds.length
      ? supabase
          .from("variation_price_tiers")
          .select("variation_id, min_quantity, unit_price")
          .in("variation_id", allVariationIds)
          .order("min_quantity", { ascending: true })
      : Promise.resolve({ data: [] as { variation_id: string; min_quantity: number; unit_price: number }[] }),
    listStorefrontAttributeMatrix(productIds),
  ]);

  const tierMap = tiersByVariationId(tierRows ?? []);

  const packs: Pack[] = products
    .map((p) => {
      const vars = varsByProduct.get(p.id) ?? [];
      if (vars.length === 0) return null;
      return toPack(
        p,
        vars,
        attributeMatrix.byProduct.get(p.id) ?? [],
        tierMap,
        attributeMatrix.variationOptionIds,
      );
    })
    .filter((x): x is Pack => x !== null);

  const { data: myOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("retailer_id", retailerId);

  const orderIds = (myOrders ?? []).map((o) => o.id);
  let orderedProductIds: string[] = [];
  if (orderIds.length > 0) {
    const { data: oi } = await supabase
      .from("order_items")
      .select("product_id")
      .in("order_id", orderIds);
    orderedProductIds = [...new Set((oi ?? []).map((r) => r.product_id))];
  }

  const { data: deliveredOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("retailer_id", retailerId)
    .eq("supplier_id", supplierId)
    .eq("status", "delivered");

  const deliveredOrderIds = (deliveredOrders ?? []).map((o) => o.id);
  let deliveredOrderedProductIds: string[] = [];
  if (deliveredOrderIds.length > 0) {
    const { data: doi } = await supabase
      .from("order_items")
      .select("product_id")
      .in("order_id", deliveredOrderIds);
    deliveredOrderedProductIds = [
      ...new Set((doi ?? []).map((r) => r.product_id)),
    ];
  }

  const orderedSet = new Set(orderedProductIds);

  const categoriesOrdered = new Set(
    packs
      .filter((p) => orderedSet.has(p.product.id))
      .map((p) => p.product.category)
      .filter((c): c is string => Boolean(c))
  );

  let suggestedPacks = packs.filter(
    (p) =>
      !orderedSet.has(p.product.id) &&
      Boolean(p.product.category) &&
      categoriesOrdered.size > 0 &&
      categoriesOrdered.has(p.product.category as string)
  );

  if (suggestedPacks.length === 0) {
    suggestedPacks = packs.filter((p) => !orderedSet.has(p.product.id));
  }

  const suggestedFiltered = suggestedPacks.slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/retailer/browse"
          className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
        >
          ← {t("backToBrowse")}
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {supplier.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={supplier.logo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {t("logoPlaceholder")}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {supplierLabel}
            </h1>
            <RatingBadge
              avgRating={Number(supplier.avg_rating) || null}
              reviewCount={supplier.review_count ?? 0}
              size="md"
              className="mt-1"
            />
            {profile?.city && <p className="text-slate-600">{profile.city}</p>}
            {supplier.marketplace_categories &&
              (supplier.marketplace_categories as string[]).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(supplier.marketplace_categories as string[]).map((slug) => (
                    <span
                      key={slug}
                      className="inline-flex rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary"
                    >
                      {tCat(slug)}
                    </span>
                  ))}
                </div>
              )}
            {supplier.description && (
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                {supplier.description}
              </p>
            )}
            {supplier.delivery_areas && supplier.delivery_areas.length > 0 && (
              <p className="mt-2 text-sm text-slate-500">
                <span className="font-medium text-slate-700">
                  {t("deliveryAreas")}
                </span>{" "}
                {supplier.delivery_areas.join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <StorefrontCatalog
        supplierId={supplierId}
        supplierLabel={supplierLabel}
        supplierCurrency={supplierCurrency}
        packs={packs}
        suggested={suggestedFiltered}
        orderedProductIds={orderedProductIds}
        deliveredOrderedProductIds={deliveredOrderedProductIds}
      />

      {(supplier.review_count ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            {tReview("reviews")}
          </h2>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
            <ReviewsList supplierId={supplierId} />
          </div>
        </section>
      )}
    </div>
  );
}
