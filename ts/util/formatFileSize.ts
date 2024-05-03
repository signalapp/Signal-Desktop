// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import filesize from 'filesize';

export function formatFileSize(size: number): string {
  return filesize(size, { round: 0 });
}
