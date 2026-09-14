// All requests go through /api; Vite proxies it to Express in development.
const BASE_URL = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const getItems = () => request('/items');

export const createItem = (item) =>
  request('/items', { method: 'POST', body: JSON.stringify(item) });

export const deleteItem = (id) => request(`/items/${id}`, { method: 'DELETE' });
