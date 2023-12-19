// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function toLogFormat(error: unknown): string {
  let result = '';
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

export class ProfileDecryptError extends Error {}
