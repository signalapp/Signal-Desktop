// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'node:buffer';
import { type Hmac } from 'node:crypto';
import { Transform } from 'node:stream';

import { MAC_LENGTH } from '../types/Crypto';

/**
 * Updates an hmac with the stream except for the last MAC_LENGTH
 * bytes. The last MAC_LENGTH bytes are passed to the callback.
 */
export function getMacAndUpdateHmac(
  hmac: Hmac,
  onTheirMac: (theirMac: Uint8Array) => void
): Transform {
  // Because we don't have a view of the entire stream, we don't know when we're
  // at the end. We need to omit the last MAC_LENGTH bytes from
  // `hmac.update` so we only push what we know is not the mac.
  let maybeMacBytes = Buffer.alloc(0);

  function updateWithKnownNonMacBytes() {
    let knownNonMacBytes = null;
    if (maybeMacBytes.byteLength > MAC_LENGTH) {
      knownNonMacBytes = maybeMacBytes.subarray(0, -MAC_LENGTH);
      maybeMacBytes = maybeMacBytes.subarray(-MAC_LENGTH);
      hmac.update(knownNonMacBytes);
    }
    return knownNonMacBytes;
  }

  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        maybeMacBytes = Buffer.concat([maybeMacBytes, chunk]);
        const knownNonMac = updateWithKnownNonMacBytes();
        callback(null, knownNonMac);
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        onTheirMac(maybeMacBytes);
        callback(null, null);
      } catch (error) {
        callback(error);
      }
    },
  });
}
