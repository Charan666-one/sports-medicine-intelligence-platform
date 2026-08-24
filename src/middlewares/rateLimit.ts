import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter — protects every /api route from abuse / brute force.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests. Please try again later.' },
});

/**
 * Stricter limiter for auth endpoints to slow credential-stuffing / brute force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many authentication attempts. Please try again later.' },
});
