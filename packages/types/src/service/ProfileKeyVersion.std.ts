// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Utf8 } from '../encodings/Utf8.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type ProfileKeyVersion = ProfileKeyVersion.Decoded;

export namespace ProfileKeyVersion {
  type Opaque = Tagged<string, 'ProfileKeyVersion'>;

  /** @public */
  export type Decoded = Utf8.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<ProfileKeyVersion, string> = z.pipe(
    z.string(),
    z.custom<ProfileKeyVersion>()
  );

  /** @public */
  export function isValid(input: string): input is ProfileKeyVersion {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): ProfileKeyVersion {
    return Schema.parse(input);
  }

  /** @public */
  export function decode(input: Encoded): ProfileKeyVersion {
    return Utf8.fromBytes(input);
  }

  /** @public */
  export function encode(input: ProfileKeyVersion): Encoded {
    return Utf8.toBytes(input);
  }
}
