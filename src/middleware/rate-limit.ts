import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 1_000;
const MAX_REQUESTS = 10;
const MAX_CLIENTS = 10_000;

type RateLimitEntry = { count: number; resetAt: number };
const clients = new Map<string, RateLimitEntry>();

function pruneExpiredClients(now: number): void {
  for (const [clientId, entry] of clients) {
    if (entry.resetAt <= now) clients.delete(clientId);
  }

  while (clients.size > MAX_CLIENTS) {
    const oldestClient = clients.keys().next().value;
    if (oldestClient === undefined) return;
    clients.delete(oldestClient);
  }
}

/** Limits each client IP to ten requests in each one-second window. */
export function rateLimitMiddleware(request: Request, response: Response, next: NextFunction): void {
  // CORS preflight requests do not reach the API handlers and should not consume quota.
  if (request.method === "OPTIONS") {
    next();
    return;
  }

  const now = Date.now();
  const clientId = request.ip || request.socket.remoteAddress || "unknown";
  let entry = clients.get(clientId);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
  }

  entry.count += 1;
  clients.set(clientId, entry);
  if (clients.size > MAX_CLIENTS) pruneExpiredClients(now);

  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
  response.setHeader("RateLimit-Limit", MAX_REQUESTS);
  response.setHeader("RateLimit-Remaining", remaining);
  response.setHeader("RateLimit-Reset", resetSeconds);

  if (entry.count > MAX_REQUESTS) {
    response.setHeader("Retry-After", resetSeconds);
    response.status(429).json({ error: "Too many requests. Limit is 10 requests per second." });
    return;
  }

  next();
}
