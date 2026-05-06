// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/** Opaque type for styles returned by tw() */
export type TailwindStyles = string & { __Styles: never };

/**
 * Joins Tailwind CSS class names, filtering out falsy values.
 *
 * @example
 * ```tsx
 * tw('flex items-center gap-2')
 * // => 'flex items-center gap-2'
 *
 * tw('my-3', isActive && 'bg-blue-500', isDisabled && 'opacity-50')
 * // => 'my-3 bg-blue-500' (when isActive=true, isDisabled=false)
 * ```
 */
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
