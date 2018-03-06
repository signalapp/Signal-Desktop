/* eslint-env node */

const Path = require('path');

const ensureError = require('ensure-error');
const isString = require('lodash/isString');


const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');
const APP_ROOT_PATH_PATTERN = new RegExp(APP_ROOT_PATH, 'g');

//      toLogFormat :: Error -> String
exports.toLogFormat = (error) => {
  const normalizedError = ensureError(error);
  const stackWithRedactedPaths = exports.redactSensitivePaths(normalizedError.stack);
  return stackWithRedactedPaths;
};

//      redactSensitivePaths :: String -> String
exports.redactSensitivePaths = (logLine) => {
  if (!isString(logLine)) {
    return logLine;
  }

  return logLine.replace(APP_ROOT_PATH_PATTERN, '<REDACTED_PATH>');
};
