// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { chunk } from 'lodash';
import * as log from '../logging/log';

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
