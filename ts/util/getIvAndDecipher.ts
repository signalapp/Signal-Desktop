// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createDecipheriv, type Decipher } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { Transform } from 'node:stream';

import { CipherType, IV_LENGTH } from '../types/Crypto';
import { strictAssert } from './assert';

/**
 * Gets the IV from the start of the stream and creates a decipher.
 * Then deciphers the rest of the stream.
 */
export function getIvAndDecipher(
  aesKey: Uint8Array,
  onFoundIv?: (iv: Buffer) => void
): Transform {
  let maybeIvBytes: Buffer | null = Buffer.alloc(0);
  let decipher: Decipher | null = null;
  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        // If we've already initialized the decipher, just pass the chunk through.
        if (decipher != null) {
          callback(null, decipher.update(chunk));
          return;
        }

        // Wait until we have enough bytes to get the iv to initialize the
        // decipher.
        maybeIvBytes = Buffer.concat([maybeIvBytes, chunk]);
        if (maybeIvBytes.byteLength < IV_LENGTH) {
          callback(null, null);
          return;
        }

        // Once we have enough bytes, initialize the decipher and pass the
        // remainder of the bytes through.
        const iv = maybeIvBytes.subarray(0, IV_LENGTH);
        const remainder = maybeIvBytes.subarray(IV_LENGTH);
        onFoundIv?.(iv);
        maybeIvBytes = null; // free memory
        decipher = createDecipheriv(CipherType.AES256CBC, aesKey, iv);
        callback(null, decipher.update(remainder));
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        strictAssert(decipher != null, 'decipher must be set');
        callback(null, decipher.final());
      } catch (error) {
        callback(error);
      }
    },
  });
}
