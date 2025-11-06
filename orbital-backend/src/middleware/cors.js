const cors = require('cors');
const logger = require('../utils/logger');

/**
 * CORS Configuration for Orbital Backend
 *
 * Allows requests from Signal-Desktop client and web frontend
 */

// Allowed origins based on environment
const getAllowedOrigins = () => {
  const origins = [];

  if (process.env.NODE_ENV === 'production') {
    // Production origins
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL);
    }
    // Add production domains
    origins.push('https://orbital.example.com');
  } else {
    // Development origins
    origins.push('http://localhost:3000');
    origins.push('http://localhost:5173'); // Vite dev server
    origins.push('http://localhost:8080'); // Vue dev server
    origins.push('http://127.0.0.1:3000');
    origins.push('http://127.0.0.1:5173');

    // Electron app origin (Signal-Desktop fork)
    origins.push('file://');
  }

  return origins;
};

// CORS options
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || origin.startsWith('file://')) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origin not allowed', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token'
  ],

  // Expose custom headers to client
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Total-Count',
    'X-Encryption-IV',
    'X-Expires-At'
  ],

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Cache preflight request for 1 hour
  maxAge: 3600,

  // Pass CORS headers to next handler
  preflightContinue: false,

  // Successful OPTIONS returns 204
  optionsSuccessStatus: 204
};

// Create CORS middleware
const corsMiddleware = cors(corsOptions);

/**
 * Apply CORS with logging
 */
function applyCORS(req, res, next) {
  logger.debug('CORS request', {
    origin: req.headers.origin,
    method: req.method,
    path: req.path
  });

  corsMiddleware(req, res, next);
}

module.exports = applyCORS;
