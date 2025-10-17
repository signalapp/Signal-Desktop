// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Turn a string (like "green") into its enum type (like `Color.Green`). Useful when
 * deserializing strings into enum types.
 *
 * It only supports enums with string values. It could theoretically support more, but:
 *
 * 1. It's easier to debug. A serialized value of "Green" is easier to associate with
 *    `Color.Green` than a serialized value of 2.
 * 2. TypeScript's default uses numeric enum values. Because the stability of values is
 *    important and it's easy to mess up the stability of values (e.g., by reordering the
 *    enum), these are discouraged here.
 *
 * Again: no "hard" technical reason why this only supports strings; it's to encourage
 * good behavior.
 */
export function makeEnumParser<
  TEnumKey extends string,
  TEnumValue extends string,
>(
  enumToParse: Record<TEnumKey, TEnumValue>,
  defaultValue: TEnumValue
): (value: unknown) => TEnumValue {
  const enumValues = new Set(Object.values(enumToParse));
  const isEnumValue = (value: unknown): value is TEnumValue =>
    typeof value === 'string' && enumValues.has(value);
  return value => (isEnumValue(value) ? value : defaultValue);
}
