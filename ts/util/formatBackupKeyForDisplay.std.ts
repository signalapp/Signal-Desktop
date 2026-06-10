// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function formatBackupKeyForDisplay(
  backupKey: string,
  { convertAmbiguousChars }: { convertAmbiguousChars: boolean }
): string {
  const spacedAndUppercase = backupKey
    .toUpperCase()
    .replace(/\s/g, '')
    .replace(/.{4}(?=.)/g, '$& ');

  if (convertAmbiguousChars) {
    return spacedAndUppercase.replace(/O/g, '#').replace(/0/g, '=');
  }

  return spacedAndUppercase;
}
