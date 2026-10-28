// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * This ensures that you're only forwarding extra props.
 */
export function forwardExtraPropsForRadix(
  rest: Record<string, never>
): Record<string, never> {
  return rest;
}

/**
 * Joins ids into a space-separated list for attributes like
 * `aria-labelledby` and `aria-describedby`, skipping missing ones.
 */
export function concatIds(
  ...input: ReadonlyArray<string | null | undefined>
): string | null {
  const { length } = input;

  let result = '';
  let first = true;

  for (let index = 0; index < length; index += 1) {
    const item = input[index];
    if (typeof item === 'string') {
      if (first) {
        first = false;
      } else {
        result += ' ';
      }
      result += item;
    }
  }

  return result !== '' ? result : null;
}
