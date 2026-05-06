// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import { memo, useInsertionEffect } from 'react';
import { Direction, Tooltip } from 'radix-ui';
import { createScrollbarGutterCssProperties } from './_internal/scrollbars.dom.tsx';
import { AxoIntl } from './_internal/AxoIntl.dom.tsx';

export type AxoProviderProps = Readonly<{
  /** Text direction for the application. */
  dir: 'ltr' | 'rtl';
  /** Localized strings used by Axo components. */
  messages: AxoIntl.Messages;
  children: ReactNode;
}>;

let runOnceGlobally = false;

/**
 * Root provider for all Axo components.
 */
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
    <AxoIntl.Provider messages={props.messages}>
      <Direction.Provider dir={props.dir}>
        <Tooltip.Provider>{props.children}</Tooltip.Provider>
      </Direction.Provider>
    </AxoIntl.Provider>
  );
});

AxoProvider.displayName = 'AxoProvider';
