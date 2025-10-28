// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type NullToUndefined<T> =
  Extract<T, null> extends never ? T : Exclude<T, null> | undefined;

export type UndefinedToNull<T> =
  Extract<T, undefined> extends never ? T : Exclude<T, undefined> | null;

export type ShallowUndefinedToNull<T extends { [key: string]: unknown }> = {
  [P in keyof T]: UndefinedToNull<T[P]>;
};
export type ShallowNullToUndefined<T extends { [key: string]: unknown }> = {
  [P in keyof T]: NullToUndefined<T[P]>;
};

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

export function convertUndefinedToNull<T>(value: T | undefined): T | null {
  if (value === undefined) {
    return null;
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function shallowConvertUndefinedToNull<T extends { [key: string]: any }>(
  obj: T
): ShallowUndefinedToNull<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};

  for (const [key, propertyValue] of Object.entries(obj)) {
    result[key] = convertUndefinedToNull(propertyValue);
  }
  return result;
}
