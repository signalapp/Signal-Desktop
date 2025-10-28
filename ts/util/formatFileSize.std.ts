// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import filesize from 'filesize';

// Intentional, `filesize` uses `jedec` standard by default
const MB = 1000 * 1000;

export function formatFileSize(size: number): string {
  return filesize(size, { round: size < MB ? 0 : 1 });
}
