import { HttpError } from '../helpers/httpError.js';

// Fixed-window, in-memory rate limiter. Counts live in this server process, so they reset on
// restart and aren't shared between instances, which suits a single-server deployment.
// With onlyFailures, requests that succeed don't count, so many people behind one school
// network can all sign in normally while repeated wrong passwords still get blocked.
export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many attempts.', onlyFailures = false }) {
  const hits = new Map();

  // Drop expired windows so the map doesn't grow forever
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(id);
    }
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const now = Date.now();
    const id = key(req);
    let entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      const minutes = Math.ceil(retryAfter / 60);
      res.set('Retry-After', String(retryAfter));
      return next(new HttpError(429, `${message} Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`));
    }

    if (onlyFailures) {
      res.on('finish', () => {
        if (res.statusCode >= 400) entry.count += 1;
      });
    } else {
      entry.count += 1;
    }
    next();
  };
}
