// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @param condition {unknown}
 * @param message {string}
 * @returns {asserts condition}
 */
export function assert(condition, message) {
  if (condition == null || condition === false) {
    throw new TypeError(message);
  }
}
