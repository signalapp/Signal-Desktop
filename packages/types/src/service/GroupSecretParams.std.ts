// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Base64 } from '../encodings/Base64.std.ts';
import type { Bytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type GroupSecretParams = GroupSecretParams.Decoded;

export namespace GroupSecretParams {
  type Opaque = Tagged<unknown, 'GroupSecretParams'>;

  /** @public */
  export type Decoded = Base64.Of<Opaque>;
  /** @public */
  export type Encoded = Bytes.Of<Opaque>;

  /** @public */
  export const Schema: z.ZodMiniType<GroupSecretParams, string> = z.pipe(
    Base64.Schema.check(z.minLength(1)),
    z.custom<GroupSecretParams>()
  );

  /** @public */
  export function isValid(input: string): input is GroupSecretParams {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromBase64(input: Base64): GroupSecretParams {
    return Schema.parse(input);
  }

  /** @public */
  export function decode(input: Encoded): GroupSecretParams {
    return Base64.fromBytes(input);
  }

  /** @public */
  export function encode(input: GroupSecretParams): Encoded {
    return Base64.toBytes(input);
  }
}
