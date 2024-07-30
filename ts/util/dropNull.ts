// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type NullToUndefined<T> =
  Extract<T, null> extends never ? T : Exclude<T, null> | undefined;

export function dropNull<T>(
  value: NonNullable<T> | null | undefined
): T | undefined {
  // eslint-disable-next-line eqeqeq
  if (value === null) {
    return undefined;
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function shallowDropNull<O extends { [key: string]: any }>(
  value: O | null | undefined
):
  | {
      [Property in keyof O]: NullToUndefined<O[Property]>;
    }
  | undefined {
  if (value == null) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};

  for (const [key, propertyValue] of Object.entries(value)) {
    result[key] = dropNull(propertyValue);
  }

  return result;
}
