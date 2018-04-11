/* eslint-env node */

const is = require('@sindresorhus/is');
const path = require('path');

const { compose } = require('lodash/fp');
const { escapeRegExp } = require('lodash');


const APP_ROOT_PATH = path.join(__dirname, '..', '..', '..');
const PHONE_NUMBER_PATTERN = /\+\d{7,12}(\d{3})/g;
const GROUP_ID_PATTERN = /(group\()([^)]+)(\))/g;
const REDACTION_PLACEHOLDER = '[REDACTED]';


//      _redactPath :: Path -> String -> String
exports._redactPath = (filePath) => {
  if (!is.string(filePath)) {
    throw new TypeError("'filePath' must be a string");
  }

  const filePathPattern = exports._pathToRegExp(filePath);

  return (text) => {
    if (!is.string(text)) {
      throw new TypeError("'text' must be a string");
    }

    if (!is.regExp(filePathPattern)) {
      return text;
    }

    return text.replace(filePathPattern, REDACTION_PLACEHOLDER);
  };
};

//      _pathToRegExp :: Path -> Maybe RegExp
exports._pathToRegExp = (filePath) => {
  try {
    const pathWithNormalizedSlashes = filePath.replace(/\//g, '\\');
    const pathWithEscapedSlashes = filePath.replace(/\\/g, '\\\\');
    const urlEncodedPath = encodeURI(filePath);
    // Safe `String::replaceAll`:
    // https://github.com/lodash/lodash/issues/1084#issuecomment-86698786
    const patternString = [
      filePath,
      pathWithNormalizedSlashes,
      pathWithEscapedSlashes,
      urlEncodedPath,
    ].map(escapeRegExp).join('|');
    return new RegExp(patternString, 'g');
  } catch (error) {
    return null;
  }
};

// Public API
//      redactPhoneNumbers :: String -> String
exports.redactPhoneNumbers = (text) => {
  if (!is.string(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(PHONE_NUMBER_PATTERN, `+${REDACTION_PLACEHOLDER}$1`);
};

//      redactGroupIds :: String -> String
exports.redactGroupIds = (text) => {
  if (!is.string(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(
    GROUP_ID_PATTERN,
    (match, before, id, after) =>
      `${before}${REDACTION_PLACEHOLDER}${id.slice(-3)}${after}`
  );
};

//      redactSensitivePaths :: String -> String
exports.redactSensitivePaths = exports._redactPath(APP_ROOT_PATH);

//      redactAll :: String -> String
exports.redactAll = compose(
  exports.redactSensitivePaths,
  exports.redactGroupIds,
  exports.redactPhoneNumbers
);
