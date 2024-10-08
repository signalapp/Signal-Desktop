// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { stringify } from 'uuid';

import { getRandomBytes } from '../Crypto';

export type GeneratedMessageIdType = Readonly<{
  id: string;
  received_at: number;
}>;

// See https://datatracker.ietf.org/doc/html/draft-ietf-uuidrev-rfc4122bis-00#section-5.7
export function generateMessageId(counter: number): GeneratedMessageIdType {
  const uuid = getRandomBytes(16);

  /* eslint-disable no-bitwise */

  // We compose uuid out of 48 bits (6 bytes of) timestamp-like counter:
  // `incrementMessageCounter`. Note big-endian encoding (which ensures proper
  // lexicographical order), and floating point divisions (because `&` operator
  // coerces to 32bit integers)

  uuid[0] = (counter / 0x10000000000) & 0xff;
  uuid[1] = (counter / 0x00100000000) & 0xff;
  uuid[2] = (counter / 0x00001000000) & 0xff;
  uuid[3] = (counter / 0x00000010000) & 0xff;
  uuid[4] = (counter / 0x00000000100) & 0xff;
  uuid[5] = (counter / 0x00000000001) & 0xff;

  // Mask out 4 bits of version number
  uuid[6] &= 0x0f;
  // And set the version to 7
  uuid[6] |= 0x70;

  // Mask out 2 bits of variant
  uuid[8] &= 0x3f;
  // And set it to "2"
  uuid[8] |= 0x80;

  /* eslint-enable no-bitwise */

  return {
    id: stringify(uuid),
    received_at: counter,
  };
}
