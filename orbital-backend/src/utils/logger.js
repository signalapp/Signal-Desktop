/**
 * Winston Logger Configuration
 * Provides structured logging for Orbital backend
 */

const winston = require('winston');
const path = require('path');

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// File format for production
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: fileFormat,
  defaultMeta: { service: 'orbital-backend' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Specialized logging methods
logger.logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userId: req.user?.id
  });
};

logger.logWebSocket = (event, data) => {
  logger.debug('WebSocket Event', { event, data });
};

logger.logDatabase = (operation, duration, query) => {
  logger.debug('Database Operation', { operation, duration: `${duration}ms`, query });
};

logger.logSignal = (operation, messageId) => {
  logger.info('Signal Protocol', { operation, messageId });
};

module.exports = logger;
