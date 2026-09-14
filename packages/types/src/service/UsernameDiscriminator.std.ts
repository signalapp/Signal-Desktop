// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import { checkWithParser } from '../_utils/schemas.std.ts';
import { parseUsernameDiscriminator } from '../_utils/usernames.std.ts';
import type { Utf8 } from '../encodings/Utf8.std.ts';

/**
 * @public
 */
export type UsernameDiscriminator = Tagged<
  Utf8.Of<`${number}`>,
  'UsernameDiscriminator'
>;

export namespace UsernameDiscriminator {
  /** @public */
  export const Schema: z.ZodMiniType<UsernameDiscriminator, string> = z.pipe(
    z.string().check(checkWithParser(parseUsernameDiscriminator)),
    z.custom<UsernameDiscriminator>()
  );

  /** @public */
  export function isValid(input: string): input is UsernameDiscriminator {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): UsernameDiscriminator {
    return Schema.parse(input);
  }
}
