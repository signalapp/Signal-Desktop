const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication Middleware using JWT
 *
 * Validates JWT tokens and attaches user info to request.
 * Required for all protected API endpoints.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '30d';

/**
 * Generate JWT token for user
 * @param {Object} user - User object with id and username
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    username: user.username
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
    issuer: 'orbital-backend'
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'orbital-backend'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_TOKEN');
    } else {
      throw error;
    }
  }
}

/**
 * Authentication middleware - validates JWT from Authorization header
 */
function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Authentication failed: No Authorization header', {
        path: req.path,
        ip: req.ip
      });
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'No authorization token provided'
      });
    }

    // Verify Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn('Authentication failed: Invalid Authorization format', {
        path: req.path,
        ip: req.ip
      });
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid authorization format. Use: Bearer <token>'
      });
    }

    const token = parts[1];

    // Verify token
    const decoded = verifyToken(token);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username
    };

    logger.debug('Authentication successful', {
      userId: req.user.userId,
      username: req.user.username,
      path: req.path
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed: Token verification error', {
      error: error.message,
      path: req.path,
      ip: req.ip
    });

    if (error.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.'
      });
    } else if (error.message === 'INVALID_TOKEN') {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      });
    } else {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication failed'
      });
    }
  }
}

/**
 * Optional authentication middleware - attaches user if token present
 * Does not fail if no token provided
 */
function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // No token provided, continue without user
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const decoded = verifyToken(token);

      req.user = {
        userId: decoded.userId,
        username: decoded.username
      };
    }

    next();
  } catch (error) {
    // Token invalid, continue without user
    logger.debug('Optional authentication failed, continuing without user', {
      error: error.message,
      path: req.path
    });
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  generateToken,
  verifyToken
};
