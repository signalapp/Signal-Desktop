// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { Bytes, type MaybeSharedBytes } from '../encodings/Bytes.std.ts';

/**
 * @public
 */
export type UsernameProof = Tagged<Bytes, 'UsernameProof'>;

export namespace UsernameProof {
  /** @public */
  export const Schema: z.ZodMiniType<UsernameProof, MaybeSharedBytes> = z.pipe(
    Bytes.Schema,
    z.custom<UsernameProof>(input => {
      return input.byteLength !== 0;
    })
  );

  /** @public */
  export function isValid(input: Bytes): input is UsernameProof {
    return Schema.safeParse(input).success;
  }
}
