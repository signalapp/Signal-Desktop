// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-env node */

import is from '@sindresorhus/is';
import { join as pathJoin } from 'path';

import { compose } from 'lodash/fp';
import { escapeRegExp } from 'lodash';

export const APP_ROOT_PATH = pathJoin(__dirname, '..', '..');

const PHONE_NUMBER_PATTERN = /\+\d{7,12}(\d{3})/g;
const UUID_PATTERN =
  /[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{9}([0-9A-F]{3})/gi;
const GROUP_ID_PATTERN = /(group\()([^)]+)(\))/g;
const GROUP_V2_ID_PATTERN = /(groupv2\()([^=)]+)(=?=?\))/g;
const REDACTION_PLACEHOLDER = '[REDACTED]';

export type RedactFunction = (value: string) => string;

export const _redactPath = (filePath: string): RedactFunction => {
  if (!is.string(filePath)) {
    throw new TypeError("'filePath' must be a string");
  }

  const filePathPattern = _pathToRegExp(filePath);

  return (text: string): string => {
    if (!is.string(text)) {
      throw new TypeError("'text' must be a string");
    }

    if (!is.regExp(filePathPattern)) {
      return text;
    }

    return text.replace(filePathPattern, REDACTION_PLACEHOLDER);
  };
};

export const _pathToRegExp = (filePath: string): RegExp | undefined => {
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
    return undefined;
  }
};

// Public API
export const redactPhoneNumbers = (text: string): string => {
  if (!is.string(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(PHONE_NUMBER_PATTERN, `+${REDACTION_PLACEHOLDER}$1`);
};

export const redactUuids = (text: string): string => {
  if (!is.string(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(UUID_PATTERN, `${REDACTION_PLACEHOLDER}$1`);
};

export const redactGroupIds = (text: string): string => {
  if (!is.string(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text
    .replace(
      GROUP_ID_PATTERN,
      (_, before, id, after) =>
        `${before}${REDACTION_PLACEHOLDER}${removeNewlines(id).slice(
          -3
        )}${after}`
    )
    .replace(
      GROUP_V2_ID_PATTERN,
      (_, before, id, after) =>
        `${before}${REDACTION_PLACEHOLDER}${removeNewlines(id).slice(
          -3
        )}${after}`
    );
};

const createRedactSensitivePaths = (
  paths: ReadonlyArray<string>
): RedactFunction => {
  return compose(paths.map(filePath => _redactPath(filePath)));
};

const sensitivePaths: Array<string> = [];

let redactSensitivePaths: RedactFunction = (text: string) => text;

export const addSensitivePath = (filePath: string): void => {
  sensitivePaths.push(filePath);
  redactSensitivePaths = createRedactSensitivePaths(sensitivePaths);
};

addSensitivePath(APP_ROOT_PATH);

export const redactAll: RedactFunction = compose(
  (text: string) => redactSensitivePaths(text),
  redactGroupIds,
  redactPhoneNumbers,
  redactUuids
);

const removeNewlines: RedactFunction = text => text.replace(/\r?\n|\r/g, '');
