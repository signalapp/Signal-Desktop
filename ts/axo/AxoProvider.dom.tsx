// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import { memo, useInsertionEffect } from 'react';
import { Tooltip } from 'radix-ui';
import { createScrollbarGutterCssProperties } from './_internal/scrollbars.dom.tsx';
import { AxoIntl } from './_internal/AxoIntl.dom.tsx';

export type AxoProviderProps = Readonly<{
  /**
   * The resolved app locale based on the system preferred language and the
   * user locale override preference
   */
  resolvedAppLocale: AxoIntl.ResolvedAppLocale;
  /**
   * The users preferred languages provided by the OS (unordered)
   */
  systemPreferredLanguages: AxoIntl.SystemPreferredLanguages;
  /**
   * Translated strings for all Axo message keys.
   */
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
    <AxoIntl.Provider
      resolvedAppLocale={props.resolvedAppLocale}
      systemPreferredLanguages={props.systemPreferredLanguages}
      messages={props.messages}
    >
      <Tooltip.Provider>{props.children}</Tooltip.Provider>
    </AxoIntl.Provider>
  );
});

AxoProvider.displayName = 'AxoProvider';
