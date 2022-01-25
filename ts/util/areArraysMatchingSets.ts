// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function areArraysMatchingSets<T>(
  left: Array<T>,
  right: Array<T>
): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  for (const item of leftSet) {
    if (!rightSet.has(item)) {
      return false;
    }
  }

  for (const item of rightSet) {
    if (!leftSet.has(item)) {
      return false;
    }
  }

  return true;
}
