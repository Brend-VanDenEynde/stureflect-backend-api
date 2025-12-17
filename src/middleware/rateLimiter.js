const rateLimit = require('express-rate-limit');

console.log('[RATE LIMITER] Initialiseren van rate limiters...');

// General API rate limiter - 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuten
  max: 100, // max 100 requests per windowMs
  message: {
    error: 'Te veel requests van dit IP, probeer het later opnieuw.',
    retryAfter: '15 minuten'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    console.log(`[RATE LIMIT] IP ${req.ip} heeft de rate limit bereikt`);
    res.status(429).json({
      error: 'Te veel requests van dit IP, probeer het later opnieuw.',
      retryAfter: '15 minuten'
    });
  }
});

// Stricter limiter for authentication endpoints - 5 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuten
  max: 5, // max 5 login/register pogingen per windowMs
  message: {
    error: 'Te veel authenticatie pogingen, probeer het later opnieuw.',
    retryAfter: '15 minuten'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    console.log(`[AUTH RATE LIMIT] IP ${req.ip} heeft te veel authenticatie pogingen gedaan`);
    res.status(429).json({
      error: 'Te veel authenticatie pogingen van dit IP, probeer het later opnieuw.',
      retryAfter: '15 minuten'
    });
  }
});

// Webhook rate limiter - more permissive for automated systems
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuut
  max: 30, // max 30 webhooks per minuut
  message: {
    error: 'Te veel webhook requests.',
    retryAfter: '1 minuut'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[WEBHOOK RATE LIMIT] IP ${req.ip} heeft de webhook rate limit bereikt`);
    res.status(429).json({
      error: 'Te veel webhook requests.',
      retryAfter: '1 minuut'
    });
  }
});

// AI service rate limiter - stricter for expensive operations
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 uur
  max: 20, // max 20 AI requests per uur
  message: {
    error: 'AI rate limit bereikt. Probeer het later opnieuw.',
    retryAfter: '1 uur'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[AI RATE LIMIT] IP ${req.ip} heeft de AI rate limit bereikt`);
    res.status(429).json({
      error: 'AI rate limit bereikt. Probeer het later opnieuw.',
      retryAfter: '1 uur'
    });
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  webhookLimiter,
  aiLimiter
};

console.log('[SUCCESS] [RATE LIMITER] Rate limiters geconfigureerd:');
console.log('[RATE LIMITER]    - General API: 100 req/15min');
console.log('[RATE LIMITER]    - Authentication: 5 req/15min (alleen mislukte pogingen)');
console.log('[RATE LIMITER]    - Webhooks: 30 req/min');
console.log('[RATE LIMITER]    - AI Services: 20 req/uur');
