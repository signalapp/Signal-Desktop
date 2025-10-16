// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { HTTPError } from './HTTPError.std.js';

export function toLogFormat(error: unknown): string {
  let result = '';

  if (error instanceof HTTPError) {
    return `HTTPError ${error.code}`;
  }

  if (error instanceof Error && error.stack) {
    result = error.stack;
  } else if (error && typeof error === 'object' && 'message' in error) {
    result = String(error.message);
  } else {
    result = String(error);
  }

  if (error && typeof error === 'object' && 'cause' in error) {
    result += `\nCaused by: ${String(error.cause)}`;
  }

  return result;
}

export function toLocation(
  source?: string,
  line?: number,
  column?: number
): string {
  if (source == null) {
    return '(@ unknown)';
  }
  if (line != null && column != null) {
    return `(@ ${source}:${line}:${column})`;
  }
  if (line != null) {
    return `(@ ${source}:${line})`;
  }
  return `(@ ${source})`;
}

export class ProfileDecryptError extends Error {}
