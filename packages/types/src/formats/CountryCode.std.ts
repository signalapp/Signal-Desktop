// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';

/**
 * ISO 3166-1 alpha-2 country code (Ex: "FR", "IN")
 * @public
 */
export type CountryCode = Tagged<string, 'CountryCode'>;

export namespace CountryCode {
  const PATTERN = /^[A-Z]{2}$/;

  /** @public */
  export const Schema: z.ZodMiniType<CountryCode, string> = z.pipe(
    z.string().check(z.regex(PATTERN)),
    z.custom<CountryCode>()
  );

  /** @public */
  export function isValid(input: string): input is CountryCode {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): CountryCode {
    return Schema.parse(input);
  }
}
