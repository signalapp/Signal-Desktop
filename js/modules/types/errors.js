const ensureError = require('ensure-error');

//      toLogFormat :: Error -> String
exports.toLogFormat = (error) => {
  const normalizedError = ensureError(error);
  return normalizedError.stack;
};
