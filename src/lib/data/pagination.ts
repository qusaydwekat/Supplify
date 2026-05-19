/** Default page size for list endpoints (tables). */
export const DEFAULT_LIST_PAGE_SIZE = 20;

/** Marketplace browse/search grids: smaller pages so pagination appears before hitting table defaults. */
export const DEFAULT_MARKETPLACE_PAGE_SIZE = 12;

export const MAX_LIST_PAGE_SIZE = 100;

export const DEFAULT_LEDGER_PAGE_SIZE = 25;

/** Supplier ledger retailer breakdown accordion */
export const DEFAULT_RETAILER_BALANCES_PAGE_SIZE = 15;

export type PaginatedResult<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export function clampPage(n: number) {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function clampPageSize(n: number) {
  const raw =
    Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_LIST_PAGE_SIZE;
  return Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, raw));
}

/** Next.js search params: values may be repeated keys as string[]. */
export type SearchParamsInput = Record<
  string,
  string | string[] | null | undefined
>;

function readParam(sp: SearchParamsInput, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string" && v.trim() !== "") return v;
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === "string" && x.trim() !== "");
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

export function parseListPagination(
  sp: SearchParamsInput,
  options?: {
    defaultPageSize?: number;
    pageParam?: string;
    pageSizeParam?: string;
  }
) {
  const pk = options?.pageParam ?? "page";
  const psk = options?.pageSizeParam ?? "pageSize";
  const defaultPs = options?.defaultPageSize ?? DEFAULT_LIST_PAGE_SIZE;
  const rawPs = parseInt(readParam(sp, psk) ?? "", 10);
  const pageSize = clampPageSize(
    Number.isFinite(rawPs) && rawPs > 0 ? rawPs : defaultPs
  );
  const page = clampPage(parseInt(readParam(sp, pk) ?? "", 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export function totalPagesFromCount(totalCount: number, pageSize: number) {
  if (totalCount <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/** Keeps slice math consistent when filters shrink results below the requested page (e.g. ?page=5 with 2 pages). */
export function clampPageToTotal(page: number, totalPages: number) {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}
