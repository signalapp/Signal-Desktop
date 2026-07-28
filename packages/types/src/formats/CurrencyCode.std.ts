// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Tagged } from 'type-fest';
import * as z from 'zod/mini';

/**
 * ISO 4217 currency code (Ex: "EUR", "INR")
 * @public
 */
export type CurrencyCode = Tagged<string, 'CurrencyCode'>;

export namespace CurrencyCode {
  const PATTERN = /^[A-Z]{3}$/;

  /** @public */
  export const Schema: z.ZodMiniType<CurrencyCode, string> = z.pipe(
    z.string().check(z.regex(PATTERN)),
    z.custom<CurrencyCode>()
  );

  /** @public */
  export function isValid(input: string): input is CurrencyCode {
    return Schema.safeParse(input).success;
  }

  /** @public */
  export function fromString(input: string): CurrencyCode {
    return Schema.parse(input);
  }
}
