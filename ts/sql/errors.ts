// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isCorruptionError(error?: Error): boolean {
  return (
    error?.message?.includes('SQLITE_CORRUPT') ||
    error?.message?.includes('database disk image is malformed') ||
    error?.message?.includes('file is not a database') ||
    false
  );
}
