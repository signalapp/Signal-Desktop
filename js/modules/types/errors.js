/* eslint-env node */

const Path = require('path');

const toError = require('ensure-error');


const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');
const APP_ROOT_PATH_PATTERN = new RegExp(APP_ROOT_PATH, 'g');

//      toLogFormat :: Error -> String
exports.toLogFormat = (error) => {
  const normalizedError = toError(error);
  const stackWithoutPrivatePaths =
    normalizedError.stack.replace(APP_ROOT_PATH_PATTERN, '<REDACTED_PATH>');
  return stackWithoutPrivatePaths;
};
