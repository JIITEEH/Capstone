// Baseline security headers for every response. In production this server also serves the built
// React app, so one middleware covers both the API and the pages.
import config from '../config/index.js';

const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // React writes inline styles on elements, and the fonts come from Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  // The manuscript preview fetches the file with the sign-in token and shows it from a blob: URL,
  // so frames must allow blob:. <object>/<embed> stay blocked.
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Only means anything over HTTPS, so it would just confuse local development
  if (config.env === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}
