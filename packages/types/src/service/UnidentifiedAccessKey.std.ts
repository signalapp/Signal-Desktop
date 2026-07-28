// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Base64 } from '../encodings/Base64.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';

/**
 * An access token for sealed sender messages
 * @public
 */
export type UnidentifiedAccessKey = UnidentifiedAccessKey.Decoded;

export namespace UnidentifiedAccessKey {
  export const SIZE = 16;

  type Opaque = Tagged<unknown, 'UnidentifiedAccessKey'>;

  /** @public */
  export type Decoded = Base64.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<UnidentifiedAccessKey, string> = z.pipe(
    Base64.Schema,
    z.custom<UnidentifiedAccessKey>(input => {
      return Base64.toBytes(input).byteLength === SIZE;
    })
  );

  /** @public */
  export function isValid(input: string): input is UnidentifiedAccessKey {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromBase64(input: Base64): UnidentifiedAccessKey {
    return Schema.parse(input);
  }

  /** @public */
  export function decode(input: Encoded): UnidentifiedAccessKey {
    return Base64.fromBytes(input);
  }

  /** @public */
  export function encode(input: UnidentifiedAccessKey): Encoded {
    return Base64.toBytes(input);
  }
}
