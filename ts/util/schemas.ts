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
import type { SafeParseReturnType, ZodError, ZodType, ZodTypeDef } from 'zod';

type Schema<Input, Output> = ZodType<Output, ZodTypeDef, Input>;
type SafeResult<Output> = SafeParseReturnType<unknown, Output>;

type LooseInput<T> =
  IsLiteral<T> extends true ? LiteralToPrimitive<T> : Record<keyof T, unknown>;

type PartialInput<T> = T extends Primitive
  ? T | null | void
  : { [Key in keyof T]?: T[Key] | null | void };

export class SchemaParseError extends TypeError {
  constructor(schema: Schema<unknown, unknown>, error: ZodError<unknown>) {
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

function parse<Output>(
  schema: Schema<unknown, Output>,
  input: unknown
): Output {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  throw new SchemaParseError(schema, result.error);
}

function safeParse<Output>(
  schema: Schema<unknown, Output>,
  input: unknown
): SafeResult<Output> {
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
type ParseUnknown     = <Input, Output, Data>(schema: Schema<Input, Output>, ...args: UnknownArgs<Data>) => Output;
// prettier-ignore
type SafeParseUnknown = <Input, Output, Data>(schema: Schema<Input, Output>, ...args: UnknownArgs<Data>) => SafeResult<Output>;
// prettier-ignore
type ParseStrict      = <Input, Output, Data extends Input>(schema: Schema<Input, Output>, ...args: TypedArgs<Data>) => Output;
// prettier-ignore
type SafeParseStrict  = <Input, Output, Data extends Input>(schema: Schema<Input, Output>, ...args: TypedArgs<Data>) => SafeResult<Output>;
// prettier-ignore
type ParseLoose       = <Input, Output, Data extends LooseInput<Input>>(schema: Schema<Input, Output>, ...args: TypedArgs<Data>) => Output;
// prettier-ignore
type SafeParseLoose   = <Input, Output, Data extends LooseInput<Input>>(schema: Schema<Input, Output>, ...args: TypedArgs<Data>) => SafeResult<Output>;
// prettier-ignore
type ParsePartial     = <Input, Output, Data extends PartialInput<Input>>(schema: Schema<Input, Output>, ...args: TypedArgs<Data>) => Output;
// prettier-ignore
type SafeParsePartial = <Input, Output, Data extends PartialInput<Input>>(schema: Schema<Input, Output>, ...args: TypedArgs<Data>) => SafeResult<Output>;

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
