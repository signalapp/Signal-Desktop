// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function toLogFormat(error: unknown): string {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }

  return String(error);
}
