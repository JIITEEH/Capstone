import fs from 'node:fs';
import { after } from 'node:test';
import { tempDir } from './setup.js';
import app from '../src/app.js';
import * as User from '../src/database-queries/userModel.js';

export const PASSWORD = 'password123';

// First bytes of each file type the server accepts, so test uploads look like real documents
export const SIGNATURES = {
  '.pdf': Buffer.from('%PDF-1.7\n'),
  '.doc': Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  '.docx': Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  // Nothing the server accepts: a Windows program
  '.exe': Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
};

// A file of exactly `bytes` length that starts with the signature its name implies
export function manuscriptBytes(name, bytes = 64) {
  const signature = SIGNATURES[name.slice(name.lastIndexOf('.')).toLowerCase()] ?? Buffer.alloc(0);
  const buffer = Buffer.alloc(Math.max(bytes, signature.length), 65);
  signature.copy(buffer, 0);
  return buffer;
}

// Starts the API on a random port for one test file. When the file finishes, the server stops
// and the throwaway database and uploads are deleted.
export async function startApi() {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  after(() => {
    server.closeAllConnections();
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function request(method, path, { token, body, form, headers: extraHeaders = {} } = {}) {
    const headers = { ...extraHeaders };
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload = form;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + path, { method, headers, body: payload });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    patch: (path, options) => request('PATCH', path, options),
    delete: (path, options) => request('DELETE', path, options),

    async login(email, password = PASSWORD, extra = {}) {
      return request('POST', '/auth/login', { body: { email, password, ...extra } });
    },

    // Uploads a fake manuscript of the given size for a stage. It carries the real signature for
    // its extension, since the server checks contents. Pass `contents` to send other bytes.
    upload(token, thesisId, stage, { bytes = 64, name = `${stage}.pdf`, contents } = {}) {
      const form = new FormData();
      form.append('stage', stage);
      form.append('notes', `Notes for ${stage}`);
      const body = contents ?? manuscriptBytes(name, bytes);
      form.append('file', new Blob([body], { type: 'application/pdf' }), name);
      return request('POST', `/theses/${thesisId}/submissions`, { token, form });
    },

    async download(token, submissionId) {
      const res = await fetch(`${base}/submissions/${submissionId}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
    },
  };
}

// Creates an account straight in the database and signs it in
export async function makeUser(api, { name, email, role = 'student', program = '' }) {
  const user = User.create({ name, email, password: PASSWORD, role, program });
  const { data } = await api.login(email);
  return { ...user, token: data.token };
}

// Lifetime of a sign-in token, in hours
export function tokenHours(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
  return (payload.exp - payload.iat) / 3600;
}

// ISO time a number of days from now, at a fixed UTC hour
export function daysFromNow(days, hour = 3) {
  const date = new Date(Date.now() + days * 86400000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}
