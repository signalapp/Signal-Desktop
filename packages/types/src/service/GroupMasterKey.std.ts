// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Base64 } from '../encodings/Base64.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type GroupMasterKey = GroupMasterKey.Decoded;

export namespace GroupMasterKey {
  export const SIZE = 32;

  type Opaque = Tagged<unknown, 'GroupMasterKey'>;

  /** @public */
  export type Decoded = Base64.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<GroupMasterKey, string> = z.pipe(
    Base64.Schema,
    z.custom<GroupMasterKey>(input => {
      return Base64.toBytes(input).byteLength === SIZE;
    })
  );

  /** @public */
  export function isValid(input: string): input is GroupMasterKey {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromBase64(input: Base64): GroupMasterKey {
    return Schema.parse(input);
  }

  /** @public */
  export function decode(input: Encoded): GroupMasterKey {
    return Base64.fromBytes(input);
  }

  /** @public */
  export function encode(input: GroupMasterKey): Encoded {
    return Base64.toBytes(input);
  }
}
