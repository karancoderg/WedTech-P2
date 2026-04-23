/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window counter per key (IP or userId).
 *
 * NOTE: This is per-instance — on serverless (Vercel), each cold start
 * gets its own map. For production at scale, use Upstash Redis or similar.
 * For a small-to-medium app, this provides meaningful protection against
 * abuse from a single origin.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check and consume a rate limit token.
 *
 * @param key - Unique identifier (e.g., `${route}:${userId}` or `${route}:${ip}`)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + config.windowSeconds * 1000;
    rateLimitMap.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Pre-configured rate limits for different endpoint categories.
 */
export const RATE_LIMITS = {
  /** Encryption oracle — tight limit */
  encrypt: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
  /** AI phone calls — very tight (costs money per call) */
  aiCall: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
  /** Email sending — tight to prevent spam */
  sendEmails: { maxRequests: 3, windowSeconds: 60 } as RateLimitConfig,
  /** Webhooks — generous but bounded */
  webhook: { maxRequests: 100, windowSeconds: 60 } as RateLimitConfig,
  /** General API — reasonable default */
  general: { maxRequests: 30, windowSeconds: 60 } as RateLimitConfig,
};
