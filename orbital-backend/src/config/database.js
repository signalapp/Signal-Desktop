const { Pool } = require('pg');
const logger = require('../utils/logger');

/**
 * PostgreSQL Database Configuration
 *
 * Uses connection pooling for efficient database access.
 * Connects to Signal messages, threads, groups, and media tables.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  min: 2,                         // Minimum connections in pool
  max: 10,                        // Maximum connections in pool
  idleTimeoutMillis: 30000,       // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Fail fast if connection unavailable
  // SSL configuration (required for production)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true
  } : false
});

// Log successful connection
pool.on('connect', (client) => {
  logger.info('New database client connected');
});

// Log connection errors
pool.on('error', (err, client) => {
  logger.error('Unexpected database error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query with $1, $2, etc. placeholders
 * @param {Array} params - Parameters to substitute
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Executed query', {
      text: text.substring(0, 100), // Log first 100 chars
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    logger.error('Database query error', {
      text: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transaction handling
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
  const client = await pool.connect();

  // Add query method to client
  const originalQuery = client.query.bind(client);
  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };

  // Add release method with error handling
  const originalRelease = client.release.bind(client);
  client.release = () => {
    client.query = originalQuery;
    return originalRelease();
  };

  return client;
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now');
    logger.info('Database connection test successful', {
      timestamp: result.rows[0].now
    });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', error);
    throw error;
  }
}

/**
 * Gracefully close all connections
 */
async function closePool() {
  logger.info('Closing database connection pool...');
  await pool.end();
  logger.info('Database connection pool closed');
}

module.exports = {
  query,
  getClient,
  testConnection,
  closePool,
  pool
};
