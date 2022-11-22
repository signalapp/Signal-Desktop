// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { get, has } from 'lodash';

export function toLogFormat(error: unknown): string {
  let result = '';
  if (error instanceof Error && error.stack) {
    result = error.stack;
  } else if (has(error, 'message')) {
    result = get(error, 'message');
  } else {
    result = String(error);
  }

  if (has(error, 'cause')) {
    result += `\nCaused by: ${String(get(error, 'cause'))}`;
  }

  return result;
}

export class ProfileDecryptError extends Error {}
