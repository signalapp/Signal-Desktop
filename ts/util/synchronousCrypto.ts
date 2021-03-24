// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import crypto from 'crypto';

import { typedArrayToArrayBuffer as toArrayBuffer } from '../Crypto';

export function sign(key: ArrayBuffer, data: ArrayBuffer): ArrayBuffer {
  return toArrayBuffer(
    crypto
      .createHmac('sha256', Buffer.from(key))
      .update(Buffer.from(data))
      .digest()
  );
}

export function hash(data: ArrayBuffer): ArrayBuffer {
  return toArrayBuffer(
    crypto.createHash('sha512').update(Buffer.from(data)).digest()
  );
}

export function encrypt(
  key: ArrayBuffer,
  data: ArrayBuffer,
  iv: ArrayBuffer
): ArrayBuffer {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key),
    Buffer.from(iv)
  );
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(data)),
    cipher.final(),
  ]);

  return toArrayBuffer(encrypted);
}

export function decrypt(
  key: ArrayBuffer,
  data: ArrayBuffer,
  iv: ArrayBuffer
): ArrayBuffer {
  const cipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(key),
    Buffer.from(iv)
  );
  const decrypted = Buffer.concat([
    cipher.update(Buffer.from(data)),
    cipher.final(),
  ]);

  return toArrayBuffer(decrypted);
}
