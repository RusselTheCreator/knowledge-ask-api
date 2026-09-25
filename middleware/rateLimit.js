/**
 * Rate Limiting Middleware
 * 
 * Protects endpoints from abuse by limiting the number of requests
 * a client can make within a time window.
 * 
 * Uses in-memory storage (simple Map). For production with multiple
 * instances, consider Redis-backed rate limiting.
 */

import dotenv from 'dotenv';

dotenv.config();

// In-memory storage for rate limit tracking
// Key format: "ip:endpoint" -> { count, resetTime }
const rateLimitStore = new Map();

// Configuration from environment variables
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

// Endpoint-specific limits
const AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10;
const UPLOAD_MAX = parseInt(process.env.RATE_LIMIT_UPLOAD_MAX) || 20;
const ASK_MAX = parseInt(process.env.RATE_LIMIT_ASK_MAX) || 50;

/**
 * Clean up expired entries from the rate limit store
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Create a rate limiter with specific max requests
 * 
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {string} identifier - Endpoint identifier for logging
 * @returns {Function} Express middleware function
 */
export function createRateLimiter(maxRequests = MAX_REQUESTS, identifier = 'default') {
  return (req, res, next) => {
    // Use IP address as the client identifier
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${clientIp}:${identifier}`;
    
    const now = Date.now();
    
    // Get or initialize rate limit data for this client
    let limitData = rateLimitStore.get(key);
    
    if (!limitData || now > limitData.resetTime) {
      // No existing data or window expired - create new window
      limitData = {
        count: 0,
        resetTime: now + WINDOW_MS
      };
      rateLimitStore.set(key, limitData);
    }
    
    // Increment request count
    limitData.count++;
    
    // Add rate limit headers to response
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - limitData.count));
    res.setHeader('X-RateLimit-Reset', new Date(limitData.resetTime).toISOString());
    
    // Check if limit exceeded
    if (limitData.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((limitData.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      
      console.warn(`Rate limit exceeded for ${clientIp} on ${identifier} (${limitData.count}/${maxRequests})`);
      
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds
      });
    }
    
    // Within limits - allow request
    next();
  };
}

// Pre-configured rate limiters for specific endpoints
export const authRateLimiter = createRateLimiter(AUTH_MAX, 'auth');
export const uploadRateLimiter = createRateLimiter(UPLOAD_MAX, 'upload');
export const askRateLimiter = createRateLimiter(ASK_MAX, 'ask');
export const generalRateLimiter = createRateLimiter(MAX_REQUESTS, 'general');

// Export default as general limiter
export default generalRateLimiter;
