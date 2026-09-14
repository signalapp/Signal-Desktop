// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';

/**
 * @public
 */
export type AccountEntropyPool = Tagged<string, 'AccountEntropyPool'>;

export namespace AccountEntropyPool {
  export const SIZE = 64;

  /** @public */
  export const Schema: z.ZodMiniType<AccountEntropyPool, string> = z.pipe(
    z
      .string()
      .check(z.length(SIZE))
      // Should use Base36 charset, but is not Base36
      .check(z.regex(/^[a-z0-9]$/)),
    z.custom<AccountEntropyPool>()
  );

  /** @public */
  export function isValid(input: string): input is AccountEntropyPool {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): AccountEntropyPool {
    return Schema.parse(input);
  }
}
