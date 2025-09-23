// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function logPadSize(size: number): number {
  return Math.max(
    541,
    Math.floor(1.05 ** Math.ceil(Math.log(size) / Math.log(1.05)))
  );
}
