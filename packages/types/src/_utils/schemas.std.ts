// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as z from 'zod/mini';
import type { Result } from '../Result.std.ts';

export type Parser = (input: string) => Result<unknown>;

export function checkWithParser(parser: Parser): z.core.$ZodCheck<string> {
  return z.superRefine((input, ctx) => {
    const result = parser(input);
    if (!result.ok) {
      ctx.issues.push({
        code: 'custom',
        message: result.error,
        input,
      });
    }
  });
}
