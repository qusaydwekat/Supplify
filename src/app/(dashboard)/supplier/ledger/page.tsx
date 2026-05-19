import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { LedgerFilters } from "@/components/ledger/ledger-filters";
import { RetailerBalancesTable } from "@/components/ledger/retailer-balances-table";
import { ManualEntryForm } from "@/components/ledger/manual-entry-form";
import { LedgerPrintButton } from "@/components/ledger/ledger-print-button";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  DEFAULT_LEDGER_PAGE_SIZE,
  DEFAULT_RETAILER_BALANCES_PAGE_SIZE,
  parseListPagination,
} from "@/lib/data/pagination";
import {
  formatLedgerMoney,
  getSupplierLedgerPageData,
} from "@/lib/data/ledger";

function fmtMoney(n: number, currency: string) {
  return formatLedgerMoney(n, currency);
}

export default async function SupplierLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    partnerId?: string;
    page?: string;
    pageSize?: string;
    rbPage?: string;
    rbPageSize?: string;
    from?: string;
    to?: string;
    type?: string;
  }>;
}) {
  const t = await getTranslations("LedgerPage");
  const sp = await searchParams;
  const partnerId = sp.partnerId?.trim() || null;
  const { page, pageSize } = parseListPagination(sp, {
    defaultPageSize: DEFAULT_LEDGER_PAGE_SIZE,
  });
  const rbPaging = parseListPagination(sp, {
    defaultPageSize: DEFAULT_RETAILER_BALANCES_PAGE_SIZE,
    pageParam: "rbPage",
    pageSizeParam: "rbPageSize",
  });

  const filters = {
    from: sp.from?.trim() || null,
    to: sp.to?.trim() || null,
    type: sp.type?.trim() || null,
  };

  const res = await getSupplierLedgerPageData(
    partnerId,
    { load: "page", page, pageSize },
    filters,
    { page: rbPaging.page, pageSize: rbPaging.pageSize }
  );
  if ("error" in res) {
    return (
      <p className="text-sm text-red-600">
        {t("errorWithDetails", { details: res.error })}
      </p>
    );
  }

  const pag = res.pagination;
  const ccy = res.displayCurrency;
  const aging = res.aging;

  const csvParams = new URLSearchParams();
  if (partnerId) csvParams.set("partnerId", partnerId);
  const csvHref = csvParams.toString()
    ? `/api/ledger/export?${csvParams}`
    : "/api/ledger/export";

  const stmtParams = new URLSearchParams();
  if (partnerId) stmtParams.set("partnerId", partnerId);
  const statementHref = stmtParams.toString()
    ? `/api/ledger/statement?${stmtParams}`
    : "/api/ledger/statement";

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (partnerId) p.set("partnerId", partnerId);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.type) p.set("type", filters.type);
    if (nextPage > 1) p.set("page", String(nextPage));
    if (pageSize !== DEFAULT_LEDGER_PAGE_SIZE)
      p.set("pageSize", String(pageSize));
    if (rbPaging.page > 1) p.set("rbPage", String(rbPaging.page));
    if (rbPaging.pageSize !== DEFAULT_RETAILER_BALANCES_PAGE_SIZE)
      p.set("rbPageSize", String(rbPaging.pageSize));
    const qs = p.toString();
    return qs ? `/supplier/ledger?${qs}` : "/supplier/ledger";
  };

  const buildRbHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (partnerId) p.set("partnerId", partnerId);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (filters.type) p.set("type", filters.type);
    if (page > 1) p.set("page", String(page));
    if (pageSize !== DEFAULT_LEDGER_PAGE_SIZE)
      p.set("pageSize", String(pageSize));
    if (nextPage > 1) p.set("rbPage", String(nextPage));
    if (rbPaging.pageSize !== DEFAULT_RETAILER_BALANCES_PAGE_SIZE)
      p.set("rbPageSize", String(rbPaging.pageSize));
    const qs = p.toString();
    return qs ? `/supplier/ledger?${qs}` : "/supplier/ledger";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:block">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("supplierSubtitle")}</p>
        </div>
        <LedgerPrintButton />
      </div>

      <Suspense
        fallback={
          <div
            className="h-10 animate-pulse rounded-md bg-slate-200"
            aria-hidden
          />
        }
      >
        <LedgerFilters
          partnerOptions={res.filterOptions}
          activePartnerId={res.activeFilterId}
          allPartnersLabel={t("allRetailers")}
          partnerSelectLabel={t("filterByRetailer")}
          csvHref={csvHref}
          statementHref={statementHref}
        />
      </Suspense>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            {t("totalInvoiced")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {fmtMoney(res.totalInvoiced, ccy)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            {t("totalCollected")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">
            {fmtMoney(res.totalCollected, ccy)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">
            {t("outstandingBalance")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {fmtMoney(res.netBalance, ccy)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t("supplierOutstandingHint")}
          </p>
        </div>
      </section>

      {aging && (
        <section className="grid gap-4 sm:grid-cols-4 print:grid-cols-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-blue-600">
              {t("agingCurrent")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-blue-900">
              {fmtMoney(aging.current, ccy)}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-amber-600">
              {t("aging30_60")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-amber-900">
              {fmtMoney(aging.days30_60, ccy)}
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-orange-600">
              {t("aging60_90")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-orange-900">
              {fmtMoney(aging.days60_90, ccy)}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-red-600">
              {t("aging90Plus")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-red-900">
              {fmtMoney(aging.days90_plus, ccy)}
            </p>
          </div>
        </section>
      )}

      {res.retailerBalancesPagination &&
        res.retailerBalancesPagination.totalCount > 0 && (
        <>
          <RetailerBalancesTable
            balances={res.retailerBalances ?? []}
            currency={ccy}
            baseHref="/supplier/ledger"
          />
          <ListPagination
            page={res.retailerBalancesPagination.page}
            totalPages={res.retailerBalancesPagination.totalPages}
            totalCount={res.retailerBalancesPagination.totalCount}
            pageSize={res.retailerBalancesPagination.pageSize}
            buildHref={buildRbHref}
          />
        </>
      )}

      <LedgerTable
        rows={res.rows}
        youLabel={t("supplierYou")}
        themLabel={t("supplierThem")}
        currency={ccy}
        role="supplier"
        retailerOptions={res.filterOptions}
        footer={
          pag ? (
            <ListPagination
              page={pag.page}
              totalPages={pag.totalPages}
              totalCount={pag.totalCount}
              pageSize={pag.pageSize}
              buildHref={buildHref}
            />
          ) : null
        }
      />

      <ManualEntryForm retailers={res.filterOptions} />
    </div>
  );
}
