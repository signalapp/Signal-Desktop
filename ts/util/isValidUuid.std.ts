// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// [47] to support v4 and v7 uuids
const UUID_REGEXP =
  /^[0-9A-F]{8}-[0-9A-F]{4}-[47][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

export const isValidUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  // Zero UUID is a valid uuid.
  if (value === '00000000-0000-0000-0000-000000000000') {
    return true;
  }

  return UUID_REGEXP.test(value);
};

const UUID_V7_REGEXP =
  /^[0-9A-F]{8}-[0-9A-F]{4}-7[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

export const isValidUuidV7 = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  // Zero UUID is a valid uuid.
  if (value === '00000000-0000-0000-0000-000000000000') {
    return true;
  }

  return UUID_V7_REGEXP.test(value);
};
