// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function encodeDelimited(
  buf: Uint8Array<ArrayBuffer>
): [Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>] {
  const len = buf.byteLength;
  let prefix: Uint8Array<ArrayBuffer>;
  if (len < 0x80) {
    prefix = new Uint8Array(1);
    prefix[0] = len;
  } else if (len < 0x4000) {
    prefix = new Uint8Array(2);
    // oxlint-disable-next-line no-bitwise
    prefix[0] = 0x80 | (len & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[1] = len >>> 7;
  } else if (len < 0x200000) {
    prefix = new Uint8Array(3);
    // oxlint-disable-next-line no-bitwise
    prefix[0] = 0x80 | (len & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[1] = 0x80 | ((len >>> 7) & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[2] = len >>> 14;
  } else if (len < 0x10000000) {
    prefix = new Uint8Array(4);
    // oxlint-disable-next-line no-bitwise
    prefix[0] = 0x80 | (len & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[1] = 0x80 | ((len >>> 7) & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[2] = 0x80 | ((len >>> 14) & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[3] = len >>> 21;
  } else {
    prefix = new Uint8Array(5);
    // oxlint-disable-next-line no-bitwise
    prefix[0] = 0x80 | (len & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[1] = 0x80 | ((len >>> 7) & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[2] = 0x80 | ((len >>> 14) & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[3] = 0x80 | ((len >>> 21) & 0x7f);
    // oxlint-disable-next-line no-bitwise
    prefix[4] = len >>> 28;
  }
  return [prefix, buf];
}
