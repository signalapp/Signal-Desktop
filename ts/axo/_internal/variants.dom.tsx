// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Must be namespace import
// See: https://react.dev/reference/react/captureOwnerStack#captureownerstack-is-not-available
import * as React from 'react';
import type { TailwindStyles } from '../tw.dom.tsx';
import { isTestOrMockEnvironment } from '../../environment.std.ts';

export type Variants<
  Key extends string | number,
  Value = TailwindStyles,
> = Readonly<{
  get: (key: Key) => Value;
  keys: () => ReadonlyArray<`${Key}`>;
}>;

export function variants<Key extends string | number, Value = TailwindStyles>(
  typeName: string,
  values: Record<Key, Value>
): Variants<Key, Value> {
  return {
    get(key) {
      if (!Object.hasOwn(values, key) && isTestOrMockEnvironment()) {
        // Will not exist in production builds
        // See: https://react.dev/reference/react/captureOwnerStack#captureownerstack-is-not-available
        const ownerStack = React.captureOwnerStack?.() ?? '';
        throw new Error(`Unexpected ${typeName}: "${key}"${ownerStack}`);
      }
      return values[key];
    },
    keys() {
      return Object.keys(values) as Array<`${Key}`>;
    },
  };
}
