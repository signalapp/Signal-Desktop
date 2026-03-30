// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { stringify } from 'uuid';

import { getRandomBytes } from '../Crypto.node.js';

export type GeneratedMessageIdType = Readonly<{
  id: string;
  received_at: number;
}>;

// See https://datatracker.ietf.org/doc/html/draft-ietf-uuidrev-rfc4122bis-00#section-5.7
export function generateMessageId(counter: number): GeneratedMessageIdType {
  const uuid = getRandomBytes(16);

  // We compose uuid out of 48 bits (6 bytes of) timestamp-like counter:
  // `incrementMessageCounter`. Note big-endian encoding (which ensures proper
  // lexicographical order), and floating point divisions (because `&` operator
  // coerces to 32bit integers)

  // oxlint-disable-next-line no-bitwise
  uuid[0] = (counter / 0x10000000000) & 0xff;
  // oxlint-disable-next-line no-bitwise
  uuid[1] = (counter / 0x00100000000) & 0xff;
  // oxlint-disable-next-line no-bitwise
  uuid[2] = (counter / 0x00001000000) & 0xff;
  // oxlint-disable-next-line no-bitwise
  uuid[3] = (counter / 0x00000010000) & 0xff;
  // oxlint-disable-next-line no-bitwise
  uuid[4] = (counter / 0x00000000100) & 0xff;
  // oxlint-disable-next-line no-bitwise
  uuid[5] = (counter / 0x00000000001) & 0xff;

  // Mask out 4 bits of version number
  // oxlint-disable-next-line no-bitwise, typescript/no-non-null-assertion
  uuid[6]! &= 0x0f;
  // And set the version to 7
  // oxlint-disable-next-line no-bitwise, typescript/no-non-null-assertion
  uuid[6]! |= 0x70;

  // Mask out 2 bits of variant
  // oxlint-disable-next-line no-bitwise, typescript/no-non-null-assertion
  uuid[8]! &= 0x3f;
  // And set it to "2"
  // oxlint-disable-next-line no-bitwise, typescript/no-non-null-assertion
  uuid[8]! |= 0x80;

  return {
    id: stringify(uuid),
    received_at: counter,
  };
}
