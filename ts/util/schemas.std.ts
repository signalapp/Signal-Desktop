// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  IfAny,
  IfEmptyObject,
  IfNever,
  IfUnknown,
  IsLiteral,
  LiteralToPrimitive,
  Primitive,
} from 'type-fest';
import type { ZodSafeParseResult, ZodError, ZodType } from 'zod';
import { z } from 'zod';

// Prevent EvalError
z.config({
  jitless: true,
});

type LooseInput<T> =
  IsLiteral<T> extends true ? LiteralToPrimitive<T> : Record<keyof T, unknown>;

type PartialInput<T> = T extends Primitive
  ? T | null | void
  : { [Key in keyof T]?: T[Key] | null | void };

export class SchemaParseError extends TypeError {
  constructor(schema: ZodType, error: ZodError) {
    let message = 'zod: issues found when parsing with schema';
    if (schema.description) {
      message += ` (${schema.description})`;
    }
    message += ':';
    for (const issue of error.issues) {
      message += `\n  - ${issue.path.join('.')}: ${issue.message}`;
    }
    super(message);
  }
}

function parse<Schema extends ZodType>(
  schema: Schema,
  input: unknown
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  throw new SchemaParseError(schema, result.error);
}

function safeParse<Schema extends ZodType>(
  schema: Schema,
  input: unknown
): ZodSafeParseResult<z.output<Schema>> {
  return schema.safeParse(input);
}

/**
 * This uses type-fest to validate that the data being passed into parse() and
 * safeParse() is not types like `any`, `{}`, `never`, or an unexpected `unknown`.
 *
 * `never` is hard to prevent from being passed in, so instead we make the function
 * arguments themselves not constructable using an intersection with a warning.
 */

// Must be exactly `unknown`
type UnknownArgs<Data> =
  IfAny<Data> extends true
    ? [data: Data] & 'Unexpected input `any` must be `unknown`'
    : IfNever<Data> extends true
      ? [data: Data] & 'Unexpected input `never` must be `unknown`'
      : IfEmptyObject<Data> extends true
        ? [data: Data] & 'Unexpected input `{}` must be `unknown`'
        : IfUnknown<Data> extends true
          ? [data: Data]
          : [data: Data] & 'Unexpected input type must be `unknown`';

type TypedArgs<Data> =
  IfAny<Data> extends true
    ? [data: Data] & 'Unexpected input `any` must be typed'
    : IfNever<Data> extends true
      ? [data: Data] & 'Unexpected input `never` must be typed'
      : IfEmptyObject<Data> extends true
        ? [data: Data] & 'Unexpected input `{}` must be typed'
        : IfUnknown<Data> extends true
          ? [data: Data] & 'Unexpected input `unknown` must be typed'
          : [data: Data];

// prettier-ignore
type ParseUnknown     = <Schema extends ZodType, Data>(schema: Schema, ...args: UnknownArgs<Data>) => z.output<Schema>;
// prettier-ignore
type SafeParseUnknown = <Schema extends ZodType, Data>(schema: Schema, ...args: UnknownArgs<Data>) => ZodSafeParseResult<z.output<Schema>>;
// prettier-ignore
type ParseStrict      = <Schema extends ZodType, Data extends z.input<Schema>>(schema: Schema, ...args: TypedArgs<Data>) => z.output<Schema>;
// prettier-ignore
type SafeParseStrict  = <Schema extends ZodType, Data extends z.input<Schema>>(schema: Schema, ...args: TypedArgs<Data>) => ZodSafeParseResult<z.output<Schema>>;
// prettier-ignore
type ParseLoose       = <Schema extends ZodType, Data extends LooseInput<z.input<Schema>>>(schema: Schema, ...args: TypedArgs<Data>) => z.output<Schema>;
// prettier-ignore
type SafeParseLoose   = <Schema extends ZodType, Data extends LooseInput<z.input<Schema>>>(schema: Schema, ...args: TypedArgs<Data>) => ZodSafeParseResult<z.output<Schema>>;
// prettier-ignore
type ParsePartial     = <Schema extends ZodType, Data extends PartialInput<z.input<Schema>>>(schema: Schema, ...args: TypedArgs<Data>) => z.output<Schema>;
// prettier-ignore
type SafeParsePartial = <Schema extends ZodType, Data extends PartialInput<z.input<Schema>>>(schema: Schema, ...args: TypedArgs<Data>) => ZodSafeParseResult<z.output<Schema>>;

/**
 * Parse an *unknown* value with a zod schema.
 * ```ts
 * type Input = unknown // unknown
 * type Output = { prop: string }
 * ```
 * @throws {SchemaParseError}
 */
export const parseUnknown: ParseUnknown = parse;

/**
 * Safely parse an *unknown* value with a zod schema.
 * ```ts
 * type Input = unknown // unknown
 * type Output = { success: true, error: null, data: { prop: string } }
 * ```
 */
export const safeParseUnknown: SafeParseUnknown = safeParse;

/**
 * Parse a *strict* value with a zod schema.
 * ```ts
 * type Input = { prop: string } // strict
 * type Output = { prop: string }
 * ```
 * @throws {SchemaParseError}
 */
export const parseStrict: ParseStrict = parse;

/**
 * Safely parse a *strict* value with a zod schema.
 * ```ts
 * type Input = { prop: string } // strict
 * type Output = { success: true, error: null, data: { prop: string } }
 * ```
 */
export const safeParseStrict: SafeParseStrict = safeParse;

/**
 * Parse a *loose* value with a zod schema.
 * ```ts
 * type Input = { prop: unknown } // loose
 * type Output = { prop: string }
 * ```
 * @throws {SchemaParseError}
 */
export const parseLoose: ParseLoose = parse;

/**
 * Safely parse a *loose* value with a zod schema.
 * ```ts
 * type Input = { prop: unknown } // loose
 * type Output = { success: true, error: null, data: { prop: string } }
 * ```
 */
export const safeParseLoose: SafeParseLoose = safeParse;

/**
 * Parse a *partial* value with a zod schema.
 * ```ts
 * type Input = { prop?: string | null | undefined } // partial
 * type Output = { prop: string }
 * ```
 * @throws {SchemaParseError}
 */
export const parsePartial: ParsePartial = parse;

/**
 * Safely parse a *partial* value with a zod schema.
 * ```ts
 * type Input = { prop?: string | null | undefined } // partial
 * type Output = { success: true, error: null, data: { prop: string } }
 * ```
 */
export const safeParsePartial: SafeParsePartial = safeParse;
