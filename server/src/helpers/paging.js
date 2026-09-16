// Page-at-a-time lists. Paging is opt-in: a request with ?page=N gets one page and the totals, and a
// request without it gets the whole list, as screens that need every row (pickers) expect.
export const PAGE_SIZE = 25;

// The 1-based page asked for, or null when the request didn't ask for paging
export function requestedPage(query) {
  if (query.page === undefined) return null;
  const page = Number(query.page);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

// Runs `count` and then `fetch` for the requested page. A page past the end shows the last page,
// so deleting the only row on the last page doesn't leave an empty screen.
export function pageOf(page, { count, fetch }) {
  const total = count();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const items = fetch({ limit: PAGE_SIZE, offset: (current - 1) * PAGE_SIZE });
  return { items, total, page: current, pages, pageSize: PAGE_SIZE };
}
