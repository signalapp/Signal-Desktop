// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Base64 } from '../encodings/Base64.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type ProfileKey = ProfileKey.Decoded;

export namespace ProfileKey {
  export const SIZE = 32;

  type Opaque = Tagged<unknown, 'ProfileKey'>;

  /** @public */
  export type Decoded = Base64.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<ProfileKey, string> = z.pipe(
    Base64.Schema,
    z.custom<ProfileKey>(input => {
      return Base64.toBytes(input).byteLength === SIZE;
    })
  );

  /** @public */
  export function isValid(input: string): input is ProfileKey {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromBase64(input: Base64): ProfileKey {
    return Schema.parse(input);
  }

  /** @public */
  export function decode(input: Encoded): ProfileKey {
    return Base64.fromBytes(input);
  }

  /** @public */
  export function encode(input: ProfileKey): Encoded {
    return Base64.toBytes(input);
  }
}
