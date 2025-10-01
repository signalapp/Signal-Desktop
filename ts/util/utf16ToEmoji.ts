// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'node:buffer';

export function utf16ToEmoji(utf16: string): string {
  const codePoints = new Array<number>();
  const buf = Buffer.from(utf16, 'hex');
  for (let i = 0; i < buf.length; i += 2) {
    codePoints.push(buf.readUint16BE(i));
  }
  return String.fromCodePoint(...codePoints);
}
