// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert.std.ts';

type LayoutMapType = { get: (code: string) => string | undefined };

let layoutMap: LayoutMapType | undefined;

export namespace KeyboardLayout {
  export async function initialize(): Promise<void> {
    strictAssert(layoutMap === undefined, 'keyboardLayout already initialized');

    const experimentalNavigator = window.navigator as unknown as {
      keyboard: { getLayoutMap: () => Promise<LayoutMapType> };
    };

    strictAssert(
      typeof experimentalNavigator.keyboard?.getLayoutMap === 'function',
      'No support for getLayoutMap'
    );

    layoutMap = await experimentalNavigator.keyboard.getLayoutMap();
  }

  export function get(code: string): string | null {
    strictAssert(layoutMap !== undefined, 'keyboardLayout not initialized');
    return layoutMap.get(code) ?? null;
  }

  export function lookup({
    code,
    key,
  }: Pick<KeyboardEvent, 'code' | 'key'>): string | undefined {
    return get(code) ?? key;
  }
}
