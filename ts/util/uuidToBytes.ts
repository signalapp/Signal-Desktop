// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk } from 'lodash';
import { UUID_BYTE_SIZE } from '../types/Crypto';
import * as log from '../logging/log';
import * as Bytes from '../Bytes';

export function getBytesSubarray(
  data: Uint8Array,
  start: number,
  n: number
): Uint8Array {
  return data.subarray(start, start + n);
}

export function bytesToUuid(bytes: Uint8Array): undefined | string {
  if (bytes.byteLength !== UUID_BYTE_SIZE) {
    log.warn(
      'bytesToUuid: received an Uint8Array of invalid length. ' +
        'Returning undefined'
    );
    return undefined;
  }

  const uuids = splitUuids(bytes);
  if (uuids.length === 1) {
    return uuids[0] || undefined;
  }
  return undefined;
}

export function splitUuids(buffer: Uint8Array): Array<string | null> {
  const uuids = new Array<string | null>();
  for (let i = 0; i < buffer.byteLength; i += UUID_BYTE_SIZE) {
    const bytes = getBytesSubarray(buffer, i, UUID_BYTE_SIZE);
    const hex = Bytes.toHex(bytes);
    const chunks = [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20),
    ];
    const uuid = chunks.join('-');
    if (uuid !== '00000000-0000-0000-0000-000000000000') {
      uuids.push(uuid);
    } else {
      uuids.push(null);
    }
  }
  return uuids;
}

export function uuidToBytes(uuid: string): Uint8Array {
  if (uuid.length !== 36) {
    log.warn(
      'uuidToBytes: received a string of invalid length. ' +
        'Returning an empty Uint8Array'
    );
    return new Uint8Array(0);
  }

  return Uint8Array.from(
    chunk(uuid.replace(/-/g, ''), 2).map(pair => parseInt(pair.join(''), 16))
  );
}
