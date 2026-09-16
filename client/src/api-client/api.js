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
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: data }),

  dashboard: () => request('/dashboard'),
  // Theses, people, and submissions the signed-in user can open, grouped
  search: (q) => request(`/search${toQuery({ q })}`),

  // Theses
  listTheses: (params) => request(`/theses${toQuery(params)}`),
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
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'manuscript';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // Schedules
  listSchedules: (params) => request(`/schedules${toQuery(params)}`),
  createSchedule: (data) => request('/schedules', { method: 'POST', body: data }),
  updateSchedule: (id, data) => request(`/schedules/${id}`, { method: 'PATCH', body: data }),
  deleteSchedule: (id) => request(`/schedules/${id}`, { method: 'DELETE' }),

  // Users (admin)
  listUsers: (params) => request(`/users${toQuery(params)}`),
  listAdvisers: () => request('/users/advisers'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: data }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};
