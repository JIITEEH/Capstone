// All requests go through /api; Vite proxies it to Express in development.
const BASE_URL = '/api';
const TOKEN_KEY = 'tms_token';

// "Keep me signed in" saves the token in localStorage; otherwise sessionStorage,
// which the browser clears when it closes
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token, { remember = true } = {}) {
    try {
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
      (remember ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
    } catch {
      // Storage unavailable (private mode); the session lasts until reload
    }
  },
  // Swaps in a new token wherever the current one is kept, so "keep me signed in" is preserved
  replace(token) {
    try {
      const remembered = localStorage.getItem(TOKEN_KEY) !== null;
      (remembered ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
      // Storage unavailable; the session lasts until reload
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

let handleUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  handleUnauthorized = fn;
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  if (raw && res.ok) return res;
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) handleUnauthorized?.();
    const error = new Error(data?.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Hands a downloaded file to the browser's save dialog
function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A CSV export, saved under the dated filename the server chose
async function downloadExport(path) {
  const res = await request(path, { raw: true });
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'export.csv';
  saveBlob(await res.blob(), fileName);
}

function toQuery(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const api = {
  // Auth
  login: (email, password, remember) =>
    request('/auth/login', { method: 'POST', body: { email, password, remember } }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) =>
    request('/auth/reset-password', { method: 'POST', body: { token, password } }),
  me: () => request('/auth/me'),
  demoAccounts: () => request('/auth/demo-accounts'),
  // Changing the password ends every session, this one included, so the server sends a new token
  // for this device. Saving it here keeps the user signed in without every caller knowing.
  async updateMe(data) {
    const result = await request('/auth/me', { method: 'PATCH', body: data });
    if (result?.token) tokenStore.replace(result.token);
    return result;
  },

  dashboard: () => request('/dashboard'),

  // Notifications: the signed-in user's own, newest first, with an unread count
  listNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
  // Theses, people, and submissions the signed-in user can open, grouped
  search: (q) => request(`/search${toQuery({ q })}`),

  // Theses
  listTheses: (params) => request(`/theses${toQuery(params)}`),
  exportTheses: (params) => downloadExport(`/theses/export.csv${toQuery(params)}`),
  getThesis: (id) => request(`/theses/${id}`),
  createThesis: (data) => request('/theses', { method: 'POST', body: data }),
  updateThesis: (id, data) => request(`/theses/${id}`, { method: 'PATCH', body: data }),
  assignAdviser: (id, adviserId) => request(`/theses/${id}/adviser`, { method: 'PATCH', body: { adviserId } }),
  updateThesisStatus: (id, status) => request(`/theses/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteThesis: (id) => request(`/theses/${id}`, { method: 'DELETE' }),
  addThesisMember: (id, email) => request(`/theses/${id}/members`, { method: 'POST', body: { email } }),
  removeThesisMember: (id, studentId) => request(`/theses/${id}/members/${studentId}`, { method: 'DELETE' }),
  createSubmission: (thesisId, formData) =>
    request(`/theses/${thesisId}/submissions`, { method: 'POST', body: formData }),

  // Submissions
  getSubmission: (id) => request(`/submissions/${id}`),
  reviewSubmission: (id, data) => request(`/submissions/${id}/review`, { method: 'PATCH', body: data }),
  addComment: (id, body) => request(`/submissions/${id}/comments`, { method: 'POST', body: { body } }),
  // The file itself, for showing in the page. The request needs the sign-in token, so the page
  // can't point an iframe straight at the API; it renders this blob instead.
  async previewSubmission(id) {
    const res = await request(`/submissions/${id}/file`, { raw: true });
    return res.blob();
  },
  async downloadSubmission(id, fileName) {
    const res = await request(`/submissions/${id}/file`, { raw: true });
    saveBlob(await res.blob(), fileName || 'manuscript');
  },

  // Schedules
  listSchedules: (params) => request(`/schedules${toQuery(params)}`),
  createSchedule: (data) => request('/schedules', { method: 'POST', body: data }),
  updateSchedule: (id, data) => request(`/schedules/${id}`, { method: 'PATCH', body: data }),
  deleteSchedule: (id) => request(`/schedules/${id}`, { method: 'DELETE' }),

  // Audit log (admin): newest first; pass `before` from the previous page to go further back
  listAudit: (params) => request(`/audit${toQuery(params)}`),

  // Users (admin)
  listUsers: (params) => request(`/users${toQuery(params)}`),
  listAdvisers: () => request('/users/advisers'),
  exportAdviserWorkload: () => downloadExport('/users/advisers/export.csv'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: data }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};
