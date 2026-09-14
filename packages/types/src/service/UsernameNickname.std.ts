// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import type { Utf8 } from '../encodings/Utf8.std.ts';
import { checkWithParser } from '../_utils/schemas.std.ts';
import { parseUsernameNickname } from '../_utils/usernames.std.ts';

/**
 * @public
 */
export type UsernameNickname = Tagged<Utf8.Of<string>, 'UsernameNickname'>;

export namespace UsernameNickname {
  /** @public */
  export const Schema: z.ZodMiniType<UsernameNickname, string> = z.pipe(
    z.string().check(checkWithParser(parseUsernameNickname)),
    z.custom<UsernameNickname>()
  );

  /** @public */
  export function isValid(input: string): input is UsernameNickname {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): UsernameNickname {
    return Schema.parse(input);
  }
}
