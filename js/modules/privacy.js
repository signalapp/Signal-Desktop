/* eslint-env node */

const Path = require('path');

const isString = require('lodash/isString');
const compose = require('lodash/fp/compose');


const PHONE_NUMBER_PATTERN = /\+\d{7,12}(\d{3})/g;
const GROUP_ID_PATTERN = /(group\()([^)]+)(\))/g;

const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');
const APP_ROOT_PATH_PATTERN = new RegExp(APP_ROOT_PATH, 'g');

const REDACTION_PLACEHOLDER = '[REDACTED]';

//      redactPhoneNumbers :: String -> String
exports.redactPhoneNumbers = (text) => {
  if (!isString(text)) {
    throw new TypeError('`text` must be a string');
  }

  return text.replace(PHONE_NUMBER_PATTERN, `+${REDACTION_PLACEHOLDER}$1`);
};

//      redactGroupIds :: String -> String
exports.redactGroupIds = (text) => {
  if (!isString(text)) {
    throw new TypeError('`text` must be a string');
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
    throw new TypeError('`text` must be a string');
  }

  return text.replace(APP_ROOT_PATH_PATTERN, REDACTION_PLACEHOLDER);
};

//      redactAll :: String -> String
exports.redactAll = compose(
  exports.redactSensitivePaths,
  exports.redactGroupIds,
  exports.redactPhoneNumbers
);
