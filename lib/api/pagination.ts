export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

export type Pagination = {
  page: number;
  limit: number;
  from: number;
  to: number;
};

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): Pagination {
  const page = positiveInteger(searchParams.get('page'), defaults.page || 1);
  const maxLimit = defaults.maxLimit || MAX_PAGE_SIZE;
  const limit = Math.min(
    positiveInteger(searchParams.get('limit'), defaults.limit || DEFAULT_PAGE_SIZE),
    maxLimit
  );
  const from = (page - 1) * limit;

  return { page, limit, from, to: from + limit - 1 };
}

export function paginationMetadata(page: number, limit: number, total: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
