const logger = require('../utils/logger');

/**
 * Error Handler Middleware for Orbital Backend
 *
 * Catches and formats all errors with consistent JSON responses
 */

/**
 * Error response format
 */
class APIError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found (404) handler
 */
function notFoundHandler(req, res, next) {
  const error = new APIError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'NOT_FOUND'
  );
  next(error);
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Input validation failed';
    details = err.errors;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (err.code === '23505') {
    // PostgreSQL unique constraint violation
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    errorCode = 'INVALID_REFERENCE';
    message = 'Referenced resource does not exist';
  } else if (err.code === '23502') {
    // PostgreSQL not null violation
    statusCode = 400;
    errorCode = 'MISSING_FIELD';
    message = 'Required field is missing';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload exceeds size limit';
  }

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: message,
      errorCode,
      statusCode,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
      stack: err.stack
    });
  } else {
    logger.warn('Client error', {
      error: message,
      errorCode,
      statusCode,
      path: req.path,
      method: req.method,
      userId: req.user?.userId
    });
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'An internal server error occurred';
    details = null;
  }

  // Send error response
  const response = {
    error: errorCode,
    message
  };

  if (details) {
    response.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error helper
 */
function validationError(message, details = null) {
  return new APIError(message, 400, 'VALIDATION_ERROR', details);
}

/**
 * Unauthorized error helper
 */
function unauthorizedError(message = 'Authentication required') {
  return new APIError(message, 401, 'UNAUTHORIZED');
}

/**
 * Forbidden error helper
 */
function forbiddenError(message = 'Access denied') {
  return new APIError(message, 403, 'FORBIDDEN');
}

/**
 * Not found error helper
 */
function notFoundError(message = 'Resource not found') {
  return new APIError(message, 404, 'NOT_FOUND');
}

/**
 * Conflict error helper
 */
function conflictError(message = 'Resource already exists') {
  return new APIError(message, 409, 'CONFLICT');
}

/**
 * Rate limit error helper
 */
function rateLimitError(message = 'Too many requests', retryAfter = null) {
  const error = new APIError(message, 429, 'TOO_MANY_REQUESTS');
  if (retryAfter) {
    error.details = { retry_after: retryAfter };
  }
  return error;
}

module.exports = {
  APIError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  rateLimitError
};
