export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> extends PaginationMeta {
  items: T[];
}

export function paginateItems<T>(items: T[], page: number, limit: number): PaginatedResult<T> {
  const safeLimit = Math.max(1, limit);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.max(1, page);
  const startIndex = (safePage - 1) * safeLimit;
  const sliced = safePage > totalPages ? [] : items.slice(startIndex, startIndex + safeLimit);

  return {
    items: sliced,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}
