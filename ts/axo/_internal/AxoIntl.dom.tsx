// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { memo, useState } from 'react';
import { createStrictContext, useStrictContext } from './StrictContext.dom.tsx';

const IntlContext =
  createStrictContext<AxoIntl.ContextType>('AxoIntl.Provider');

/** @internal Localization context for built-in Axo UI strings. */
export namespace AxoIntl {
  const DefaultMessages = {
    'AxoAlertDialog.Cancel': 'Cancel',
    'AxoButton.Pending': 'Pending',
    'AxoDialog.Back': 'Back',
    'AxoDialog.Close': 'Close',
    'AxoTextField.Clear': 'Clear',
  };

  /** A key for a built-in Axo UI string. */
  export type MessageKey = keyof typeof DefaultMessages;

  /** Map of all message keys to their translated strings. */
  export type Messages = Record<MessageKey, string>;

  /** The intl API available via `useAxoIntl`. */
  export type ContextType = Readonly<{
    get: (key: MessageKey) => string;
  }>;

  function createIntlContext(messages: Messages): ContextType {
    return {
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
    /** Translated strings for all Axo message keys. */
    messages: Messages;
    children: ReactNode;
  }>;

  /** Provides translated strings to all Axo components in the tree. */
  export const Provider: FC<ProviderProps> = memo(props => {
    const { messages } = props;
    const [intl] = useState(() => {
      return createIntlContext(messages);
    });
    return (
      <IntlContext.Provider value={intl}>{props.children}</IntlContext.Provider>
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
