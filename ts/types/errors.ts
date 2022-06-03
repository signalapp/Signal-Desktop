// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { get, has } from 'lodash';

export function toLogFormat(error: unknown): string {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }

  if (has(error, 'message')) {
    return get(error, 'message');
  }

  return String(error);
}

export class ProfileDecryptError extends Error {}
