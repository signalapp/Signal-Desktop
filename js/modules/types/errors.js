const ensureError = require('ensure-error');

const Privacy = require('../privacy');

//      toLogFormat :: Error -> String
exports.toLogFormat = (error) => {
  const normalizedError = ensureError(error);
  return Privacy.redactAll(normalizedError.stack);
};
