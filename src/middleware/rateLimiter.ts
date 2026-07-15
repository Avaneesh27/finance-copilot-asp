import { Request, Response, NextFunction } from 'express';

interface HitRecord {
  count: number;
  windowStart: number;
}

const store = new Map<string, HitRecord>();
const RPM = parseInt(process.env.RATE_LIMIT_RPM ?? '60', 10);
const WINDOW_MS = 60_000;

/**
 * Sliding-window in-memory rate limiter.
 * Allows RPM requests per IP per 60-second window.
 * Returns 429 with shared error envelope on breach.
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();

  const record = store.get(ip);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    next();
    return;
  }

  if (record.count >= RPM) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Limit is ${RPM} requests per minute per IP.`,
      },
    });
    return;
  }

  record.count += 1;
  next();
}

// Prune the store every 5 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of store.entries()) {
    if (now - record.windowStart >= WINDOW_MS * 5) {
      store.delete(ip);
    }
  }
}, 5 * 60_000);
