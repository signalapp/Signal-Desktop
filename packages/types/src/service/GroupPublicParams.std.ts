// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Base64 } from '../encodings/Base64.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type GroupPublicParams = GroupPublicParams.Decoded;

export namespace GroupPublicParams {
  type Opaque = Tagged<unknown, 'GroupPublicParams'>;

  /** @public */
  export type Decoded = Base64.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<GroupPublicParams, string> = z.pipe(
    Base64.Schema.check(z.minLength(1)),
    z.custom<GroupPublicParams>()
  );

  /** @public */
  export function isValid(input: string): input is GroupPublicParams {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromBase64(input: Base64): GroupPublicParams {
    return Schema.parse(input);
  }

  /** @public */
  export function decode(input: Encoded): GroupPublicParams {
    return Base64.fromBytes(input);
  }

  /** @public */
  export function encode(input: GroupPublicParams): Encoded {
    return Base64.toBytes(input);
  }
}
