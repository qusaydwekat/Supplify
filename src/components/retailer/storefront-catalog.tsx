"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ProductCard,
  type StorefrontVariation,
} from "@/components/products/product-card";
import type { ProductAttributeRow } from "@/lib/data/products/attributes";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  has_variations: boolean;
};

type Pack = {
  product: ProductRow;
  variations: StorefrontVariation[];
  attributes: ProductAttributeRow[];
};

type Props = {
  supplierId: string;
  supplierLabel: string;
  supplierCurrency: string;
  packs: Pack[];
  suggested: Pack[];
  orderedProductIds: string[];
  /** Products that appear on at least one delivered order with this supplier (enables Reorder). */
  deliveredOrderedProductIds: string[];
};

export function StorefrontCatalog({
  supplierId,
  supplierLabel,
  supplierCurrency,
  packs,
  suggested,
  orderedProductIds,
  deliveredOrderedProductIds,
}: Props) {
  const t = useTranslations("StorefrontCatalog");
  const orderedSet = useMemo(
    () => new Set(orderedProductIds),
    [orderedProductIds]
  );
  const reorderableSet = useMemo(
    () => new Set(deliveredOrderedProductIds),
    [deliveredOrderedProductIds]
  );
  const categories = useMemo(() => {
    const s = new Set<string>();
    packs.forEach((p) => {
      if (p.product.category) s.add(p.product.category);
    });
    return [...s].sort();
  }, [packs]);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<
    "recommended" | "price_low" | "price_high" | "name"
  >("recommended");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = packs.filter((p) => {
      if (category !== "all" && (p.product.category ?? "") !== category)
        return false;
      if (!needle) return true;
      const name = p.product.name.toLowerCase();
      const desc = (p.product.description ?? "").toLowerCase();
      return name.includes(needle) || desc.includes(needle);
    });
    const minPrice = (p: Pack) =>
      Math.min(...p.variations.map((v) => Number(v.price)));
    return [...base].sort((a, b) => {
      if (sort === "name") return a.product.name.localeCompare(b.product.name);
      if (sort === "price_low") return minPrice(a) - minPrice(b);
      if (sort === "price_high") return minPrice(b) - minPrice(a);
      // recommended: ordered first, then name
      const ao = orderedSet.has(a.product.id) ? 1 : 0;
      const bo = orderedSet.has(b.product.id) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return a.product.name.localeCompare(b.product.name);
    });
  }, [packs, q, category, sort, orderedSet]);

  return (
    <div className="space-y-8">
      <div className="sticky top-16 z-10 -mx-4 border-y border-border bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:top-20 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("searchLabel")}
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-3">
            <div className="min-w-0 sm:w-48">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("category")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">{t("allCategories")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 sm:w-48">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("sort")}
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="recommended">{t("sortRecommended")}</option>
                <option value="name">{t("sortName")}</option>
                <option value="price_low">{t("sortPriceLow")}</option>
                <option value="price_high">{t("sortPriceHigh")}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("resultsCount", { count: filtered.length })}</span>
          {(q.trim() || category !== "all" || sort !== "recommended") && (
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setQ("");
                setCategory("all");
                setSort("recommended");
              }}
            >
              {t("clear")}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {filtered.map((pack) => (
          <ProductCard
            key={pack.product.id}
            supplierId={supplierId}
            supplierLabel={supplierLabel}
            supplierCurrency={supplierCurrency}
            product={{
              ...pack.product,
              category: pack.product.category,
            }}
            variations={pack.variations}
            attributes={pack.attributes}
            hasOrderedBefore={orderedSet.has(pack.product.id)}
            showReorder={reorderableSet.has(pack.product.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noMatch")}</p>
      )}

      {suggested.length > 0 && (
        <section className="border-t border-border pt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("suggestedTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("suggestedSubtitle")}
              </p>
            </div>
          </div>
          <div className={cn('mt-4 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4')}>
            {suggested.map((pack) => (
              <ProductCard
                key={pack.product.id}
                supplierId={supplierId}
                supplierLabel={supplierLabel}
                supplierCurrency={supplierCurrency}
                product={{
                  ...pack.product,
                  category: pack.product.category,
                }}
                variations={pack.variations}
                attributes={pack.attributes}
                hasOrderedBefore={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
