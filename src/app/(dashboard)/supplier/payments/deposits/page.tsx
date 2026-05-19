import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireRequestUserId } from "@/lib/auth/request-session";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDateTimeShort, normalizeAppLocale } from "@/lib/format-datetime";
import { formatMoney } from "@/lib/format-money";
import { DepositProofActions } from "@/components/payments/deposit-proof-actions";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  DEFAULT_LIST_PAGE_SIZE,
  clampPageToTotal,
  parseListPagination,
  totalPagesFromCount,
} from "@/lib/data/pagination";

type DepositProofRow = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_currency: string;
  bank_name: string | null;
  branch: string | null;
  reference_note: string | null;
  deposit_date: string | null;
  status: "pending" | "confirmed" | "rejected";
  created_at: string;
  invoice_number: string | null;
  retailer_label: string;
};

export default async function SupplierDepositsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; pageSize?: string }>;
}) {
  const t = await getTranslations("DepositProofsInbox");
  const locale = normalizeAppLocale(await getLocale());
  const userId = await requireRequestUserId();
  const supabase = supabaseServer();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!supplier) redirect("/login");

  const params = await searchParams;
  const statusFilter = (params.status ?? "pending") as
    | "pending"
    | "confirmed"
    | "rejected"
    | "all";

  const { page, pageSize } = parseListPagination(params, {
    defaultPageSize: DEFAULT_LIST_PAGE_SIZE,
  });

  let countQ = supabase
    .from("payment_deposit_proofs")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplier.id);
  if (statusFilter !== "all") countQ = countQ.eq("status", statusFilter);
  const { count: totalCountRaw, error: countErr } = await countQ;
  if (countErr) {
    return (
      <p className="text-sm text-red-600">
        {countErr.message}
      </p>
    );
  }
  const totalCount = totalCountRaw ?? 0;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  const effectivePage = clampPageToTotal(page, totalPages);

  let listQ = supabase
    .from("payment_deposit_proofs")
    .select(
      "id, invoice_id, amount, payment_currency, bank_name, branch, reference_note, deposit_date, status, created_at, retailer_id"
    )
    .eq("supplier_id", supplier.id)
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") listQ = listQ.eq("status", statusFilter);

  const fromIdx = (effectivePage - 1) * pageSize;
  listQ = listQ.range(fromIdx, fromIdx + pageSize - 1);
  const { data: proofs, error: listErr } = await listQ;
  if (listErr) {
    return (
      <p className="text-sm text-red-600">
        {listErr.message}
      </p>
    );
  }

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (statusFilter !== "pending") p.set("status", statusFilter);
    if (nextPage > 1) p.set("page", String(nextPage));
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE)
      p.set("pageSize", String(pageSize));
    const qs = p.toString();
    return qs ? `/supplier/payments/deposits?${qs}` : "/supplier/payments/deposits";
  };

  const invoiceIds = [
    ...new Set((proofs ?? []).map((r) => r.invoice_id as string)),
  ];
  const retailerIds = [
    ...new Set((proofs ?? []).map((r) => r.retailer_id as string)),
  ];
  const [{ data: invoices }, { data: profiles }] = await Promise.all([
    invoiceIds.length
      ? supabase
          .from("invoices")
          .select("id, invoice_number")
          .in("id", invoiceIds)
      : Promise.resolve({
          data: [] as { id: string; invoice_number: string }[],
        }),
    retailerIds.length
      ? supabase
          .from("profiles")
          .select("user_id, business_name, name")
          .in("user_id", retailerIds)
      : Promise.resolve({
          data: [] as {
            user_id: string;
            business_name: string;
            name: string;
          }[],
        }),
  ]);

  const invoiceMap = new Map(
    (invoices ?? []).map((i) => [i.id as string, i.invoice_number as string])
  );
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.user_id as string,
      (p.business_name || p.name || "—").trim() || "—",
    ])
  );

  const rows: DepositProofRow[] = (proofs ?? []).map((r) => ({
    id: r.id as string,
    invoice_id: r.invoice_id as string,
    amount: Number(r.amount),
    payment_currency: String(r.payment_currency),
    bank_name: (r.bank_name as string | null) ?? null,
    branch: (r.branch as string | null) ?? null,
    reference_note: (r.reference_note as string | null) ?? null,
    deposit_date: (r.deposit_date as string | null) ?? null,
    status: r.status as DepositProofRow["status"],
    created_at: r.created_at as string,
    invoice_number: invoiceMap.get(r.invoice_id as string) ?? null,
    retailer_label: profileMap.get(r.retailer_id as string) ?? "—",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(["pending", "confirmed", "rejected", "all"] as const).map((s) => (
            <Link
              key={s}
              href={`/supplier/payments/deposits?status=${s}`}
              className={`rounded-full px-3 py-1 ${
                statusFilter === s
                  ? "bg-slate-900 text-white"
                  : "border border-border bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t(`filter_${s}`)}
            </Link>
          ))}
        </div>
      </div>

      <div className="app-surface overflow-hidden">
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground md:px-6">
          {t("empty")}
        </p>
      ) : (
        <div className="divide-y divide-border">
          <div className="space-y-3 p-4 md:p-5">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/supplier/invoices/${r.invoice_id}`}
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {r.invoice_number ?? r.invoice_id.slice(0, 8)}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {r.retailer_label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {t(`status_${r.status}`)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-900">
                    <span className="font-semibold">
                      {formatMoney(r.amount, r.payment_currency)}
                    </span>
                    {r.deposit_date ? (
                      <span className="ms-2 text-xs text-slate-500">
                        {t("depositedOn", { date: r.deposit_date })}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {r.bank_name ? <span>{r.bank_name}</span> : null}
                    {r.branch ? <span className="ms-2">{r.branch}</span> : null}
                  </div>
                  {r.reference_note ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                      {r.reference_note}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("submittedAt", {
                      when: formatDateTimeShort(r.created_at, locale),
                    })}
                  </p>
                </div>
                {r.status === "pending" ? (
                  <DepositProofActions id={r.id} />
                ) : null}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
        <ListPagination
          page={effectivePage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          buildHref={buildHref}
        />
      </div>
    </div>
  );
}
