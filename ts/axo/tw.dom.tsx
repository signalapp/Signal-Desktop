// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type TailwindStyles = string & { __Styles: never };

export function tw(
  ...classNames: ReadonlyArray<
    TailwindStyles | string | boolean | null | undefined
  >
): TailwindStyles {
  const { length } = classNames;

  let result = '';
  let first = true;

  for (let index = 0; index < length; index += 1) {
    const className = classNames[index];
    if (typeof className === 'string') {
      if (first) {
        first = false;
      } else {
        result += ' ';
      }
      result += className;
    }
  }

  return result as TailwindStyles;
}
