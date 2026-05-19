import { getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/format-money";
import { getSupplierInventoryInsightsPaged } from "@/lib/data/inventory-insights";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parseListPagination,
} from "@/lib/data/pagination";
import { ListPagination } from "@/components/ui/list-pagination";

export default async function SupplierInventoryInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const t = await getTranslations("InventoryInsightsPage");
  const sp = await searchParams;
  const { page, pageSize } = parseListPagination(sp, {
    defaultPageSize: DEFAULT_LIST_PAGE_SIZE,
  });

  const res = await getSupplierInventoryInsightsPaged({ page, pageSize });

  if ("error" in res) {
    return <p className="text-sm text-red-600">{res.error}</p>;
  }

  const {
    rows,
    totalValuation,
    reorderFlaggedCount,
    currencyCode,
    totalCount,
    totalPages,
    effectivePage,
  } = res;

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (nextPage > 1) p.set("page", String(nextPage));
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE)
      p.set("pageSize", String(pageSize));
    const qs = p.toString();
    return qs ? `/supplier/inventory-insights?${qs}` : "/supplier/inventory-insights";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            {t("totalValuation")}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(totalValuation, currencyCode)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t("valuationHint")}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-amber-900">
            {t("reorderCandidates")}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-950">
            {reorderFlaggedCount}
          </p>
          <p className="mt-1 text-xs text-amber-900/90">{t("reorderHint")}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("tableTitle")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{t("tableHint")}</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {t("empty")}
          </p>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-start text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">{t("colProduct")}</th>
                  <th className="px-4 py-2">{t("colVariation")}</th>
                  <th className="px-4 py-2 text-end">{t("colStock")}</th>
                  <th className="px-4 py-2 text-end">{t("colSold30")}</th>
                  <th className="px-4 py-2 text-end">{t("colCover")}</th>
                  <th className="px-4 py-2 text-end">{t("colLineVal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.variationId} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-900">
                      {r.productName}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.variationLabel ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {r.stock}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {r.unitsSold30d}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {r.coverDays != null
                        ? `${r.coverDays} ${t("days")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-end font-medium tabular-nums">
                      {formatMoney(r.valuationLine, currencyCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ListPagination
          page={effectivePage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          buildHref={buildHref}
        />
      </section>
    </div>
  );
}
