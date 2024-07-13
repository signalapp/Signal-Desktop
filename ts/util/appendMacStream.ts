// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createHmac } from 'crypto';
import { Transform } from 'stream';
import type { Duplex } from 'stream';

import { HashType } from '../types/Crypto';

export const MAC_KEY_SIZE = 32;

export const MAC_SIZE = 32;

export function appendMacStream(
  macKey: Uint8Array,
  onMac?: (mac: Uint8Array) => undefined
): Duplex {
  if (macKey.byteLength !== MAC_KEY_SIZE) {
    throw new Error('appendMacStream: invalid macKey length');
  }

  const hmac = createHmac(HashType.size256, macKey);
  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        hmac.update(chunk);
        callback(null, chunk);
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        const mac = hmac.digest();
        onMac?.(mac);
        callback(null, mac);
      } catch (error) {
        callback(error);
      }
    },
  });
}
