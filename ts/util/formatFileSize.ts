// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import filesize from 'filesize';

export function formatFileSize(size: number, decimals = 0): string {
  return filesize(size, { round: decimals });
}
