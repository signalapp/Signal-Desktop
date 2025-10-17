// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import protobufjs from 'protobufjs';

const { Reader } = protobufjs;

type MessageWithUnknownFields = {
  $unknownFields?: ReadonlyArray<Uint8Array>;
};

/**
 * Returns an array of the tags of unknown fields in a protobuf message.
 *
 * Clients may use slightly different definitions of our protos, in cases where
 * we don't recognize a field, we store it in `$unknownFields`.
 *
 * For example:
 *
 * ```proto
 * // Our proto definition
 * message Foo {
 *   optional string bar = 1;
 * }
 *
 * // Their proto definition
 * message Foo {
 *   optional string bar = 1;
 *   optional string baz = 2;
 * }
 * ```
 *
 * If we receive a message with `baz` set, we'll store it in `$unknownFields`.
 *
 * This function will then return `[2]`.
 */
export function inspectUnknownFieldTags(
  message: MessageWithUnknownFields
): Array<number> {
  return (
    message.$unknownFields?.map(field => {
      // https://protobuf.dev/programming-guides/encoding/
      // The first byte of a field is a varint encoding the tag bit-shifted << 3
      // eslint-disable-next-line no-bitwise
      return new Reader(field).uint32() >>> 3;
    }) ?? []
  );
}
