// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';
import type { Utf8 } from '../encodings/Utf8.std.ts';
import type { UsernameNickname } from './UsernameNickname.std.ts';
import type { UsernameDiscriminator } from './UsernameDiscriminator.std.ts';
import { joinUsernameParams, parseUsername } from '../_utils/usernames.std.ts';

/**
 * @public
 */
export type Username = Tagged<
  Utf8.Of<`${UsernameNickname}.${UsernameDiscriminator}`>,
  'Username'
>;

export namespace Username {
  /** @public */
  export type Params = Readonly<{
    nickname: UsernameNickname;
    discriminator: UsernameDiscriminator;
  }>;

  /** @public */
  export const Schema: z.ZodMiniType<Username, string> = z.pipe(
    z.string(),
    z.custom<Username>()
  );

  /** @public */
  export function isValid(input: string): input is Username {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): Username {
    return Schema.parse(input);
  }

  export function fromParams(params: Params): Username {
    return joinUsernameParams(params);
  }

  export function toParams(username: Username): Params {
    const result = parseUsername(username);
    if (!result.ok) {
      throw new TypeError(result.error);
    }
    return result.value;
  }
}
