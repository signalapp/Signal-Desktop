// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import { memo, StrictMode } from 'react';
import { AxoProvider } from '../axo/AxoProvider.dom.tsx';
import type { AxoProviderProps } from '../axo/AxoProvider.dom.tsx';

export type AppProviderProps = Readonly<{
  children: ReactNode;
}>;

export const AppProvider: FC<AppProviderProps> = memo(
  function AppProvider(props) {
    const { i18n } = window.SignalContext;
    const dir = window.SignalContext.getResolvedMessagesLocaleDirection();

    const messages: AxoProviderProps['messages'] = {
      'AxoAlertDialog.Cancel': i18n('icu:AxoAlertDialog.Cancel'),
      'AxoButton.Pending': i18n('icu:AxoButton.Pending'),
      'AxoDialog.Back': i18n('icu:AxoDialog.Back'),
      'AxoDialog.Close': i18n('icu:AxoDialog.Close'),
      'AxoTextField.Clear': i18n('icu:AxoTextField.Clear'),
    };

    return (
      <StrictMode>
        <AxoProvider dir={dir} messages={messages}>
          {props.children}
        </AxoProvider>
      </StrictMode>
    );
  }
);
