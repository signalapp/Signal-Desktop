// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @param {string} utf16
 * @returns {string}
 */
export function utf16ToEmoji(utf16) {
  /** @type {Array<number>} */
  const codePoints = [];
  const buf = Buffer.from(utf16, 'hex');
  for (let i = 0; i < buf.length; i += 2) {
    codePoints.push(buf.readUint16BE(i));
  }
  return String.fromCodePoint(...codePoints);
}
