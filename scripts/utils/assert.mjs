// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @param {boolean} condition
 * @param {string} message
 * @returns {asserts condition}
 */
export function assert(condition, message) {
  if (!condition) {
    throw new TypeError(message);
  }
}

/**
 * @param {never} value
 * @returns {never}
 */
export function unreachable(value) {
  throw new TypeError(`Expected case to be unreachable, found ${value}`);
}
