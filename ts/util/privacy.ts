/* eslint-env node */

import { escapeRegExp, isEmpty, isRegExp, isString } from 'lodash';
import { compose } from 'lodash/fp';
import { getAppRootPath } from '../node/getRootPath';
import { isDevProd } from '../shared/env_vars';

const APP_ROOT_PATH = getAppRootPath();
const SESSION_ID_PATTERN = /\b((05)?[0-9a-f]{64})\b/gi;
const SNODE_PATTERN =
  /(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
const GROUP_ID_PATTERN = /(group\()([^)]+)(\))/g;
const SERVER_URL_PATTERN =
  /https?:\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
const REDACTION_PLACEHOLDER = '[REDACTED]';

//  redactPath :: Path -> String -> String
const redactPath = (filePath: string) => {
  if (!filePath) {
    throw new TypeError("'filePath' must be a string");
  }

  const filePathPattern = _pathToRegExp(filePath);

  return (text: string) => {
    if (!isString(text)) {
      throw new TypeError("'text' must be a string");
    }

    if (!isRegExp(filePathPattern)) {
      return text;
    }

    return text.replace(filePathPattern, REDACTION_PLACEHOLDER);
  };
};

//      _pathToRegExp :: Path -> Maybe RegExp
const _pathToRegExp = (filePath: string) => {
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
    ]
      .map(escapeRegExp)
      .join('|');
    return new RegExp(patternString, 'g');
  } catch (error) {
    return null;
  }
};

// Public API
//      redactSessionID :: String -> String
const redactSessionID = (text: string) => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replaceAll(SESSION_ID_PATTERN, REDACTION_PLACEHOLDER);
};

const redactSnodeIP = (text: string) => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replaceAll(SNODE_PATTERN, REDACTION_PLACEHOLDER);
};

const redactServerUrl = (text: string) => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replaceAll(SERVER_URL_PATTERN, REDACTION_PLACEHOLDER);
};

//      redactGroupIds :: String -> String
const redactGroupIds = (text: string) => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replaceAll(
    GROUP_ID_PATTERN,
    (_match, before, id, after) =>
      `${before}${REDACTION_PLACEHOLDER}${removeNewlines(id).slice(-3)}${after}`
  );
};
const removeNewlines = (text: string) => text.replace(/\r?\n|\r/g, '');

//      redactSensitivePaths :: String -> String
const redactSensitivePaths = redactPath(APP_ROOT_PATH);

function shouldNotRedactLogs() {
  // if featureFlag is set to true, trust it
  if (!isEmpty(process.env.SESSION_DEBUG_DISABLE_REDACTED)) {
    return true;
  }
  // otherwise we don't want to redact logs when running on the devprod env
  return isDevProd();
}

//      redactAll :: String -> String
export const redactAll = !shouldNotRedactLogs()
  ? compose(redactSensitivePaths, redactGroupIds, redactSessionID, redactSnodeIP, redactServerUrl)
  : (text: string) => text;
