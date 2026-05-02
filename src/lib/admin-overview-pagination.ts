export function clampOverviewPage(
  requestedPage: number,
  totalCount: number,
  pageSize: number
) {
  const safeRequestedPage = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.floor(requestedPage)
    : 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return Math.min(safeRequestedPage, totalPages);
}

export function paginateOverviewRows<T extends { sortAt: string }>(
  rows: T[],
  page: number,
  pageSize: number
) {
  const sortedRows = [...rows].sort(
    (left, right) =>
      new Date(right.sortAt).getTime() - new Date(left.sortAt).getTime()
  );
  const offset = (page - 1) * pageSize;

  return sortedRows.slice(offset, offset + pageSize);
}