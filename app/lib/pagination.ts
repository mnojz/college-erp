/**
 * Shared pagination helpers for collection endpoints.
 *
 * Usage (in a route handler):
 *   const { page, pageSize, skip, limit } = parsePageParams(searchParams, { pageSize: 20 });
 *   const [items, total] = await Promise.all([
 *     prisma.x.findMany({ where, take: limit, skip, orderBy }),
 *     prisma.x.count({ where }),
 *   ]);
 *   return NextResponse.json(paginatedResponse(items, total, page, pageSize));
 */

export interface PageParams {
  /** 1-based page index. */
  page: number;
  /** Number of items per page (capped at 100). */
  pageSize: number;
  /** Rows to skip (pre-computed: (page - 1) * pageSize). */
  skip: number;
  /** `take` value for Prisma (= pageSize). */
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function parsePageParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; pageSize?: number } = {},
): PageParams {
  const defaultPage = defaults.page ?? 1;
  const defaultSize = defaults.pageSize ?? 20;

  const rawPage = searchParams.get("page");
  const rawSize = searchParams.get("pageSize");

  const page = Math.max(
    1,
    Number.isNaN(Number(rawPage)) ? defaultPage : Number(rawPage) || defaultPage,
  );
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number.isNaN(Number(rawSize)) ? defaultSize : Number(rawSize) || defaultSize,
    ),
  );

  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize };
}

/** Build a cursor/offset-style pagination envelope from already-fetched items. */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, pageSize > 0 ? Math.ceil(safeTotal / pageSize) : 1);

  return {
    items,
    total: safeTotal,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Shape returned to the client. `items` is replaced by the caller's collection
 * key (e.g. `notifications`) for backward compatibility, while `pagination`
 * is always present on paginated endpoints.
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  const result = paginate(items, total, page, pageSize);
  return {
    items: result.items,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
    },
  };
}