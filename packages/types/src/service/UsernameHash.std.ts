// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Bytes, type MaybeSharedBytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type UsernameHash = Tagged<Bytes, 'UsernameHash'>;

export namespace UsernameHash {
  export const SIZE = 32;

  /** @public */
  export const Schema: z.ZodMiniType<UsernameHash, MaybeSharedBytes> = z.pipe(
    Bytes.Schema,
    z.custom<UsernameHash>(input => {
      return input.byteLength === SIZE;
    })
  );

  /** @public */
  export function isValid(input: Bytes): input is UsernameHash {
    return Schema.safeParse(input).success;
  }
}
