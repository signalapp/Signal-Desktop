// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { TailwindStyles } from '../tw.dom.tsx';

/** @internal */
export function concatClassNames(
  classNames: ReadonlyArray<string | boolean | null | undefined>
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

/** @internal */
export function css(
  ...classnames: Array<
    TailwindStyles | `axo-${string}` | boolean | null | undefined
  >
): TailwindStyles {
  return concatClassNames(classnames);
}
