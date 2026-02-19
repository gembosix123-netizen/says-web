/**
 * Rate Limiting Utility
 * =====================
 * Protects API endpoints from brute-force attacks using Upstash Redis
 * 
 * Usage:
 * ```ts
 * const rateLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 900000 });
 * const { success, remaining } = await rateLimiter.check('ip-address');
 * if (!success) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
 * ```
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client (works both in Vercel and self-hosted)
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

interface RateLimiterOptions {
  maxAttempts: number;   // Maximum attempts allowed
  windowMs: number;       // Time window in milliseconds
  blockDurationMs?: number; // How long to block after exceeding limit
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
  blocked?: boolean;
}

/**
 * Create a rate limiter with specified options
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    maxAttempts,
    windowMs,
    blockDurationMs = windowMs * 2, // Default: block for 2x the window
  } = options;

  return {
    /**
     * Check if identifier (IP/username) is within rate limits
     * @param identifier - Unique identifier (IP address, username, etc.)
     * @param namespace - Optional namespace for different limits (e.g., 'login', 'api')
     */
    async check(
      identifier: string,
      namespace: string = 'default'
    ): Promise<RateLimitResult> {
      // Fallback: If Redis not configured, allow all requests (development mode)
      if (!redis) {
        console.warn('[Rate Limiter] Redis not configured - rate limiting disabled');
        return {
          success: true,
          remaining: maxAttempts,
          resetAt: new Date(Date.now() + windowMs),
        };
      }

      const key = `ratelimit:${namespace}:${identifier}`;
      const blockKey = `ratelimit:block:${namespace}:${identifier}`;
      const now = Date.now();

      try {
        // Check if currently blocked
        const blockUntil = await redis.get<number>(blockKey);
        if (blockUntil && now < blockUntil) {
          return {
            success: false,
            remaining: 0,
            resetAt: new Date(blockUntil),
            blocked: true,
          };
        }

        // Get current attempts
        const attempts = await redis.get<number>(key);
        const currentAttempts = attempts || 0;

        if (currentAttempts >= maxAttempts) {
          // Exceeded limit - block the identifier
          const blockUntilTime = now + blockDurationMs;
          await redis.set(blockKey, blockUntilTime, {
            px: blockDurationMs, // Set expiry in milliseconds
          });

          return {
            success: false,
            remaining: 0,
            resetAt: new Date(blockUntilTime),
            blocked: true,
          };
        }

        // Increment attempts
        const newAttempts = currentAttempts + 1;
        
        // Set new attempt count with expiry
        if (currentAttempts === 0) {
          // First attempt - set with NX (only if not exists) and expiry
          await redis.set(key, newAttempts, {
            px: windowMs,
            nx: true,
          });
        } else {
          // Subsequent attempts - just update value
          await redis.set(key, newAttempts, {
            px: windowMs,
          });
        }

        return {
          success: true,
          remaining: maxAttempts - newAttempts,
          resetAt: new Date(now + windowMs),
        };
      } catch (error) {
        console.error('[Rate Limiter] Redis error:', error);
        // On error, fail open (allow request) to avoid blocking legitimate users
        return {
          success: true,
          remaining: maxAttempts,
          resetAt: new Date(now + windowMs),
        };
      }
    },

    /**
     * Reset rate limit for an identifier (e.g., after successful login)
     */
    async reset(identifier: string, namespace: string = 'default'): Promise<void> {
      if (!redis) return;

      const key = `ratelimit:${namespace}:${identifier}`;
      const blockKey = `ratelimit:block:${namespace}:${identifier}`;

      try {
        await redis.del(key);
        await redis.del(blockKey);
      } catch (error) {
        console.error('[Rate Limiter] Failed to reset:', error);
      }
    },

    /**
     * Get current rate limit status without incrementing
     */
    async getStatus(
      identifier: string,
      namespace: string = 'default'
    ): Promise<RateLimitResult> {
      if (!redis) {
        return {
          success: true,
          remaining: maxAttempts,
          resetAt: new Date(Date.now() + windowMs),
        };
      }

      const key = `ratelimit:${namespace}:${identifier}`;
      const blockKey = `ratelimit:block:${namespace}:${identifier}`;
      const now = Date.now();

      try {
        const blockUntil = await redis.get<number>(blockKey);
        if (blockUntil && now < blockUntil) {
          return {
            success: false,
            remaining: 0,
            resetAt: new Date(blockUntil),
            blocked: true,
          };
        }

        const attempts = await redis.get<number>(key) || 0;
        return {
          success: attempts < maxAttempts,
          remaining: Math.max(0, maxAttempts - attempts),
          resetAt: new Date(now + windowMs),
        };
      } catch (error) {
        console.error('[Rate Limiter] Failed to get status:', error);
        return {
          success: true,
          remaining: maxAttempts,
          resetAt: new Date(now + windowMs),
        };
      }
    },
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Login: 5 attempts per 15 minutes
  login: createRateLimiter({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
  }),

  // API: 100 requests per minute
  api: createRateLimiter({
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  }),

  // Password reset: 3 attempts per hour
  passwordReset: createRateLimiter({
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 2 * 60 * 60 * 1000, // Block for 2 hours
  }),
};

/**
 * Helper to get client IP address from Next.js request
 */
export function getClientIp(request: Request): string {
  // Try to get real IP from headers (works with proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }

  // Fallback to 'unknown' if IP cannot be determined
  return 'unknown';
}
