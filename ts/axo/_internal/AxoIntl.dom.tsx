// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Tagged } from 'type-fest';
import type { FC, ReactNode } from 'react';
import { memo, useMemo } from 'react';
import { createStrictContext, useStrictContext } from './StrictContext.dom.tsx';
import type { LanguageTag } from '@signalapp/types';
import { Direction as RadixDirection } from 'radix-ui';

const IntlContext =
  createStrictContext<AxoIntl.ContextType>('AxoIntl.Provider');

/** Localization context for built-in Axo UI strings. */
export namespace AxoIntl {
  const DefaultMessages = {
    'AxoAlertDialog.Cancel': 'Cancel',
    'AxoButton.Pending': 'Pending',
    'AxoDialog.Back': 'Back',
    'AxoDialog.Close': 'Close',
    'AxoTextField.Clear': 'Clear',
    'AxoPasswordField.Reveal': 'Show Password',
    'AxoBadge.MaxOverflow': (max: number) => `${max}+`,
    'AxoContactName.InSystemContactsLabel': 'This person is in your contacts.',
  };

  /** Map of all message keys to their translated strings. */
  export type Messages = typeof DefaultMessages;

  /** A key for a built-in Axo UI string. */
  export type MessageKey = keyof Messages;

  /** Directionality of text */
  export type Direction = 'ltr' | 'rtl';

  /** A locale tag supported by the app */
  export type AppLocaleTag = Tagged<LanguageTag, 'AxoIntl.AppLocaleTag'>;

  /**
   * The resolved app locale based on the system preferred language and the
   * user's app preferences.
   */
  export type ResolvedAppLocale = Readonly<{
    tag: AppLocaleTag;
    direction: Direction;
  }>;

  /** The users preferred languages provided by the OS (unordered) */
  export type SystemPreferredLanguages = ReadonlySet<LanguageTag>;

  /** The intl API available via `useAxoIntl`. */
  export type ContextType = Readonly<{
    /**
     * The resolved app locale based on the system preferred language and the
     * user's app preferences.
     */
    resolvedAppLocale: ResolvedAppLocale;
    /**
     * The users preferred languages provided by the OS (unordered)
     */
    systemPreferredLanguages: SystemPreferredLanguages;
    /**
     * Lookup message by key in the resolved app locale
     */
    get: <const K extends MessageKey>(key: K) => Messages[K];
  }>;

  function createIntlContext(
    resolvedAppLocale: ResolvedAppLocale,
    systemPreferredLanguages: SystemPreferredLanguages,
    messages: Messages
  ): ContextType {
    return {
      resolvedAppLocale,
      systemPreferredLanguages,
      get(key) {
        return messages[key] ?? DefaultMessages[key];
      },
    };
  }

  /**
   * <AxoIntl.Provider>
   * --------------------------------------------------------------------------
   */

  export type ProviderProps = Readonly<{
    /**
     * The resolved app locale based on the system preferred language and the
     * user locale override preference
     */
    resolvedAppLocale: ResolvedAppLocale;
    /**
     * The users preferred languages provided by the OS (unordered)
     */
    systemPreferredLanguages: SystemPreferredLanguages;
    /**
     * Translated strings for all Axo message keys.
     */
    messages: Messages;
    children: ReactNode;
  }>;

  /** Provides translated strings to all Axo components in the tree. */
  export const Provider: FC<ProviderProps> = memo(props => {
    const { messages, resolvedAppLocale, systemPreferredLanguages } = props;
    const intl = useMemo(() => {
      return createIntlContext(
        resolvedAppLocale,
        systemPreferredLanguages,
        messages
      );
    }, [resolvedAppLocale, systemPreferredLanguages, messages]);
    return (
      <IntlContext.Provider value={intl}>
        <RadixDirection.Provider dir={intl.resolvedAppLocale.direction}>
          {props.children}
        </RadixDirection.Provider>
      </IntlContext.Provider>
    );
  });

  Provider.displayName = 'AxoIntl.Provider';
}

/**
 * useAxoIntl()
 * --------------------------------------------------------------------------
 */

/** Returns the intl context for reading translated Axo UI strings. */
export function useAxoIntl(): AxoIntl.ContextType {
  return useStrictContext(IntlContext);
}
