const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => {
  const window = windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  return rateLimit({
    windowMs: window,
    max: max || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: message || {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(window / 1000)
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
};

// Specific rate limiters - development vs production settings
const isDevelopment = process.env.NODE_ENV !== 'production';

// Much more lenient general limiter for development
const generalLimiter = createRateLimit(
  isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 min dev, 15 min prod
  isDevelopment ? 1000 : 100, // 1000 dev, 100 prod
  {
    error: isDevelopment 
      ? 'Rate limit reached. Please wait a moment before making more requests.'
      : 'Too many requests from this IP, please try again later.',
    retryAfter: isDevelopment ? 60 : 900
  }
);

const authLimiter = createRateLimit(
  isDevelopment ? 5 * 60 * 1000 : 15 * 60 * 1000, // 5 min dev, 15 min prod
  isDevelopment ? 50 : (parseInt(process.env.RATE_LIMIT_MAX_LOGIN_ATTEMPTS) || 5), // 50 dev, 5 prod
  {
    error: isDevelopment 
      ? 'Too many login attempts, please wait a moment before trying again.'
      : 'Too many authentication attempts, please try again later.',
    retryAfter: isDevelopment ? 300 : 900 // 5 min dev, 15 min prod
  }
);

const apiLimiter = createRateLimit(
  60 * 1000, // 1 minute
  isDevelopment ? 200 : 50, // 200 dev, 50 prod
  {
    error: 'Too many API requests, please slow down.',
    retryAfter: 60
  }
);

// Security headers configuration
const helmetConfig = {
  contentSecurityPolicy: false, // Disabled CSP to allow external resources
  hsts: {
    maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: 'same-origin'
  }
};

// Compression configuration
const compressionConfig = {
  level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
};

// Input validation middleware
const validateInput = (req, res, next) => {
  // Basic input sanitization
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove any potential script tags
        req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        // Limit string length to prevent DoS
        if (req.body[key].length > 10000) {
          return res.status(400).json({ error: 'Input too large' });
        }
      }
    }
  }
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({ 
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  helmet: helmet(helmetConfig),
  compression: compression(compressionConfig),
  generalLimiter,
  authLimiter,
  apiLimiter,
  validateInput,
  errorHandler
};