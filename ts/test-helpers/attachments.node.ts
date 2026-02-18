// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Bytes from '../Bytes.std.js';
import { getRandomBytes } from '../Crypto.node.js';

export function testPlaintextHash(): string {
  return Bytes.toHex(getRandomBytes(32));
}
export function testAttachmentKey(): string {
  return Bytes.toBase64(getRandomBytes(64));
}
export function testAttachmentLocalKey(): string {
  return Bytes.toBase64(getRandomBytes(32));
}
export function testAttachmentDigest(): string {
  return Bytes.toBase64(getRandomBytes(32));
}
