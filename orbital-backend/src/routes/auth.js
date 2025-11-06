const express = require('express');
const bcrypt = require('bcrypt');
const { generateToken } = require('../middleware/auth');
const { asyncHandler, validationError, conflictError } = require('../middleware/errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Authentication API Endpoints
 *
 * Handles user signup and login with JWT token generation.
 */

const BCRYPT_ROUNDS = 12;

/**
 * Validate username format
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return 'Username is required';
  }

  if (username.length < 3 || username.length > 50) {
    return 'Username must be between 3 and 50 characters';
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }

  return null;
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }

  if (password.length < 12) {
    return 'Password must be at least 12 characters';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }

  return null;
}

/**
 * POST /api/signup
 * Register new user account
 */
router.post('/signup', asyncHandler(async (req, res) => {
  const { username, password, public_key } = req.body;

  // Validate username
  const usernameError = validateUsername(username);
  if (usernameError) {
    throw validationError(usernameError);
  }

  // Validate password
  const passwordError = validatePassword(password);
  if (passwordError) {
    throw validationError(passwordError);
  }

  // Validate public key
  if (!public_key || typeof public_key !== 'object') {
    throw validationError('Public key is required and must be a JSON object (JWK format)');
  }

  // Check if username already exists
  const existingUser = await db.query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );

  if (existingUser.rowCount > 0) {
    throw conflictError('Username already taken');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create user
  const result = await db.query(
    `INSERT INTO users (username, password_hash, public_key)
     VALUES ($1, $2, $3)
     RETURNING id, username, public_key, created_at`,
    [username, passwordHash, JSON.stringify(public_key)]
  );

  const user = result.rows[0];

  // Generate JWT token
  const token = generateToken(user);

  logger.info('User registered', {
    userId: user.id,
    username: user.username
  });

  res.status(201).json({
    user_id: user.id,
    username: user.username,
    token
  });
}));

/**
 * POST /api/login
 * Authenticate existing user
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw validationError('Username and password are required');
  }

  // Fetch user
  const result = await db.query(
    'SELECT id, username, password_hash, public_key FROM users WHERE username = $1',
    [username]
  );

  if (result.rowCount === 0) {
    // Don't reveal whether username exists
    logger.warn('Login attempt with non-existent username', { username });
    throw validationError('Invalid credentials');
  }

  const user = result.rows[0];

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    logger.warn('Login attempt with invalid password', {
      userId: user.id,
      username: user.username
    });
    throw validationError('Invalid credentials');
  }

  // Generate JWT token
  const token = generateToken(user);

  logger.info('User logged in', {
    userId: user.id,
    username: user.username
  });

  res.status(200).json({
    user_id: user.id,
    username: user.username,
    public_key: user.public_key,
    token
  });
}));

/**
 * POST /api/verify-token
 * Verify if JWT token is valid (for client-side token refresh)
 */
router.post('/verify-token', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw validationError('Token is required');
  }

  try {
    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);

    // Fetch user to ensure still exists
    const result = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rowCount === 0) {
      throw validationError('User not found');
    }

    const user = result.rows[0];

    res.status(200).json({
      valid: true,
      user_id: user.id,
      username: user.username
    });
  } catch (error) {
    logger.debug('Token verification failed', {
      error: error.message
    });

    res.status(200).json({
      valid: false,
      error: error.message
    });
  }
}));

/**
 * GET /api/users/:username/public-key
 * Get public key for a user (for encryption key exchange)
 */
router.get('/users/:username/public-key', asyncHandler(async (req, res) => {
  const { username } = req.params;

  const result = await db.query(
    'SELECT id, username, public_key FROM users WHERE username = $1',
    [username]
  );

  if (result.rowCount === 0) {
    throw validationError('User not found');
  }

  const user = result.rows[0];

  res.status(200).json({
    user_id: user.id,
    username: user.username,
    public_key: user.public_key
  });
}));

module.exports = router;
