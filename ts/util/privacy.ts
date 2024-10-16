// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-env node */

import path from 'path';

import { compose } from 'lodash/fp';
import { escapeRegExp, isString, isRegExp } from 'lodash';

import type { ExtendedStorageID } from '../types/StorageService.d';
import type { ConversationModel } from '../models/conversations';

export const APP_ROOT_PATH = path.join(__dirname, '..', '..');

const PHONE_NUMBER_PATTERN = /\+\d{7,12}(\d{3})/g;
// The additional 0 in [0-8] and [089AB] are to include MY_STORY_ID
const UUID_OR_STORY_ID_PATTERN =
  /[0-9A-F]{8}-[0-9A-F]{4}-[0-8][0-9A-F]{3}-[089AB][0-9A-F]{3}-[0-9A-F]{9}([0-9A-F]{3})/gi;
const GROUP_ID_PATTERN = /(group\()([^)]+)(\))/g;
const GROUP_V2_ID_PATTERN = /(groupv2\()([^=)]+)(=?=?\))/g;
const CALL_LINK_ROOM_ID_PATTERN = /[0-9A-F]{61}([0-9A-F]{3})/gi;
const CALL_LINK_ROOT_KEY_PATTERN =
  /([A-Z]{4})-[A-Z]{4}-[A-Z]{4}-[A-Z]{4}-[A-Z]{4}-[A-Z]{4}-[A-Z]{4}-[A-Z]{4}/gi;
const ATTACHMENT_URL_KEY_PATTERN = /(attachment:\/\/[^\s]+key=)([^\s]+)/gi;
const REDACTION_PLACEHOLDER = '[REDACTED]';

export type RedactFunction = (value: string) => string;

export function redactStorageID(
  storageID: string,
  version?: number,
  conversation?: ConversationModel
): string {
  const convoId = conversation ? ` ${conversation?.idForLogging()}` : '';
  return `${version ?? '?'}:${storageID.substring(0, 3)}${convoId}`;
}

export function redactExtendedStorageID({
  storageID,
  storageVersion,
}: ExtendedStorageID): string {
  return redactStorageID(storageID, storageVersion);
}

export const _redactPath = (filePath: string): RedactFunction => {
  if (!isString(filePath)) {
    throw new TypeError("'filePath' must be a string");
  }

  const filePathPattern = _pathToRegExp(filePath);

  return (text: string): string => {
    if (!isString(text)) {
      throw new TypeError("'text' must be a string");
    }

    if (!isRegExp(filePathPattern)) {
      return text;
    }

    return text.replace(filePathPattern, REDACTION_PLACEHOLDER);
  };
};

export const _pathToRegExp = (filePath: string): RegExp | undefined => {
  try {
    return new RegExp(
      // Any possible prefix that we want to include
      `(${escapeRegExp('file:///')})?${
        // The rest of the file path
        filePath
          // Split by system path seperator ("/" or "\\")
          // (split by both for tests)
          .split(/\/|\\/)
          // Escape all special characters in each part
          .map(part => {
            // This segment may need to be URI encoded
            const urlEncodedPart = encodeURI(part);
            // If its the same, then we don't need to worry about it
            if (urlEncodedPart === part) {
              return escapeRegExp(part);
            }
            // Otherwise, we need to test against both
            return `(${escapeRegExp(part)}|${escapeRegExp(urlEncodedPart)})`;
          })
          // Join the parts back together with any possible path seperator
          .join(
            `(${[
              // Posix (Linux, macOS, etc.)
              path.posix.sep,
              // Windows
              path.win32.sep,
              // Windows (URI encoded)
              encodeURI(path.win32.sep),
            ]
              // Escape the parts for use in a RegExp (e.g. "/" -> "\/")
              .map(sep => escapeRegExp(sep))
              // In case separators are repeated in the path (e.g. "\\\\")
              .map(sep => `${sep}+`)
              // Join all the possible separators together
              .join('|')})`
          )
      }`,
      'g'
    );
  } catch (error) {
    return undefined;
  }
};

// Public API
export const redactPhoneNumbers = (text: string): string => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(PHONE_NUMBER_PATTERN, `+${REDACTION_PLACEHOLDER}$1`);
};

export const redactUuids = (text: string): string => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(UUID_OR_STORY_ID_PATTERN, `${REDACTION_PLACEHOLDER}$1`);
};

export const redactGroupIds = (text: string): string => {
  if (!isString(text)) {
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

export const redactCallLinkRoomIds = (text: string): string => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(CALL_LINK_ROOM_ID_PATTERN, `${REDACTION_PLACEHOLDER}$1`);
};

export const redactCallLinkRootKeys = (text: string): string => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(CALL_LINK_ROOT_KEY_PATTERN, `${REDACTION_PLACEHOLDER}$1`);
};

export const redactAttachmentUrlKeys = (text: string): string => {
  if (!isString(text)) {
    throw new TypeError("'text' must be a string");
  }

  return text.replace(ATTACHMENT_URL_KEY_PATTERN, `$1${REDACTION_PLACEHOLDER}`);
};

export const redactCdnKey = (cdnKey: string): string => {
  return `${REDACTION_PLACEHOLDER}${cdnKey.slice(-3)}`;
};

export const redactGenericText = (text: string): string => {
  return `${REDACTION_PLACEHOLDER}${text.slice(-3)}`;
};

export const redactAttachmentUrl = (urlString: string): string => {
  try {
    const url = new URL(urlString);
    url.search = '';
    return url.toString();
  } catch {
    return REDACTION_PLACEHOLDER;
  }
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
  redactUuids,
  redactCallLinkRoomIds,
  redactCallLinkRootKeys,
  redactAttachmentUrlKeys
);

const removeNewlines: RedactFunction = text => text.replace(/\r?\n|\r/g, '');
