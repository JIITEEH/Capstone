import { useState } from 'react';

// The page number for a filtered list. It goes back to page 1 whenever the filters change, without an
// extra request for the old page: `filters` is compared on every render.
export default function usePage(filters) {
  const key = JSON.stringify(filters);
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  return [page, (next) => setState({ key, page: next })];
}
