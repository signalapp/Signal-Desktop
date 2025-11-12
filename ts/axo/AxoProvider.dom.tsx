// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import React, { memo, useInsertionEffect } from 'react';
import { Direction } from 'radix-ui';
import { createScrollbarGutterCssProperties } from './_internal/scrollbars.dom.js';

type AxoProviderProps = Readonly<{
  dir: 'ltr' | 'rtl';
  children: ReactNode;
}>;

let runOnceGlobally = false;

export const AxoProvider: FC<AxoProviderProps> = memo(props => {
  useInsertionEffect(() => {
    if (runOnceGlobally) {
      return;
    }
    runOnceGlobally = true;

    const unsubscribe = createScrollbarGutterCssProperties();

    return () => {
      unsubscribe();
      runOnceGlobally = false;
    };
  });
  return (
    <Direction.Provider dir={props.dir}>{props.children}</Direction.Provider>
  );
});

AxoProvider.displayName = 'AxoProvider';
