// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import { memo, useInsertionEffect, useMemo } from 'react';
import { Tooltip } from 'radix-ui';
import { LanguageTag } from '@signalapp/types';
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

/**
 * <TestAxoProvider>
 * --------------------------------------------------------------------------
 */

const TEST_SYSTEM_PREFERRED_LANGUAGES: AxoIntl.SystemPreferredLanguages =
  new Set([LanguageTag.fromString('en-US')]);

export type TestAxoProviderProps = Readonly<{
  /** @default 'ltr' */
  direction?: AxoIntl.Direction;
  children: ReactNode;
}>;

/**
 * `<AxoProvider>` with the default English messages, for stories and tests.
 * Uses Arabic as the app locale in RTL.
 */
export const TestAxoProvider: FC<TestAxoProviderProps> = memo(props => {
  const direction = props.direction ?? 'ltr';

  const resolvedAppLocale = useMemo((): AxoIntl.ResolvedAppLocale => {
    const tag = LanguageTag.fromString(direction === 'rtl' ? 'ar' : 'en');
    return { tag: tag as AxoIntl.AppLocaleTag, direction };
  }, [direction]);

  return (
    <AxoProvider
      resolvedAppLocale={resolvedAppLocale}
      systemPreferredLanguages={TEST_SYSTEM_PREFERRED_LANGUAGES}
      messages={AxoIntl.DefaultMessages}
    >
      {props.children}
    </AxoProvider>
  );
});

TestAxoProvider.displayName = 'TestAxoProvider';
