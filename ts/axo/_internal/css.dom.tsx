// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { TailwindStyles } from '../tw.dom.tsx';

/** @internal */
export function concatClassNames(
  input: ReadonlyArray<string | boolean | null | undefined>
): TailwindStyles {
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

  return result as TailwindStyles;
}

/** @internal */
export function css(
  ...input: Array<TailwindStyles | `axo-${string}` | boolean | null | undefined>
): TailwindStyles {
  return concatClassNames(input);
}
