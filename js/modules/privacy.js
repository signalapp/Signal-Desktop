/* eslint-env node */

const Path = require('path');

const compose = require('lodash/fp/compose');
const escapeRegExp = require('lodash/escapeRegExp');
const isRegExp = require('lodash/isRegExp');
const isString = require('lodash/isString');


const PHONE_NUMBER_PATTERN = /\+\d{7,12}(\d{3})/g;
const GROUP_ID_PATTERN = /(group\()([^)]+)(\))/g;

const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');
const APP_ROOT_PATH_PATTERN = (() => {
  try {
    // Safe `String::replaceAll`:
    // https://github.com/lodash/lodash/issues/1084#issuecomment-86698786
    return new RegExp(escapeRegExp(APP_ROOT_PATH), 'g');
  } catch (error) {
    return null;
  }
})();

const REDACTION_PLACEHOLDER = '[REDACTED]';

//      redactPhoneNumbers :: String -> String
exports.redactPhoneNumbers = (text) => {
  if (!isString(text)) {
    throw new TypeError('"text" must be a string');
  }

  return text.replace(PHONE_NUMBER_PATTERN, `+${REDACTION_PLACEHOLDER}$1`);
};

//      redactGroupIds :: String -> String
exports.redactGroupIds = (text) => {
  if (!isString(text)) {
    throw new TypeError('"text" must be a string');
  }

  return text.replace(
    GROUP_ID_PATTERN,
    (match, before, id, after) =>
      `${before}${REDACTION_PLACEHOLDER}${id.slice(-3)}${after}`
  );
};

//      redactSensitivePaths :: String -> String
exports.redactSensitivePaths = (text) => {
  if (!isString(text)) {
    throw new TypeError('"text" must be a string');
  }

  if (!isRegExp(APP_ROOT_PATH_PATTERN)) {
    return text;
  }

  return text.replace(APP_ROOT_PATH_PATTERN, REDACTION_PLACEHOLDER);
};

//      redactAll :: String -> String
exports.redactAll = compose(
  exports.redactSensitivePaths,
  exports.redactGroupIds,
  exports.redactPhoneNumbers
);
