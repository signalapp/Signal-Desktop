// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import { memo, StrictMode } from 'react';
import { AxoProvider } from '../axo/AxoProvider.dom.tsx';
import type { AxoProviderProps } from '../axo/AxoProvider.dom.tsx';
import type { AxoIntl } from '../axo/_internal/AxoIntl.dom.tsx';
import type { LanguageTag } from '@signalapp/types';

export type AppProviderProps = Readonly<{
  children: ReactNode;
}>;

export const AppProvider: FC<AppProviderProps> = memo(
  function AppProvider(props) {
    const { i18n } = window.SignalContext;
    const locale = window.SignalContext.getResolvedMessagesLocale();
    const direction = window.SignalContext.getResolvedMessagesLocaleDirection();

    const resolvedAppLocale: AxoIntl.ResolvedAppLocale = {
      tag: locale as AxoIntl.AppLocaleTag,
      direction,
    };

    const systemPreferredLanguages: AxoIntl.SystemPreferredLanguages = new Set(
      window.SignalContext.getPreferredSystemLocales() as Array<LanguageTag>
    );

    const messages: AxoProviderProps['messages'] = {
      'AxoAlertDialog.Cancel': i18n('icu:AxoAlertDialog.Cancel'),
      'AxoBadge.MaxOverflow': max => i18n('icu:AxoBadge.MaxOverflow', { max }),
      'AxoButton.Pending': i18n('icu:AxoButton.Pending'),
      'AxoDialog.Back': i18n('icu:AxoDialog.Back'),
      'AxoDialog.Close': i18n('icu:AxoDialog.Close'),
      'AxoPasswordField.Reveal': i18n('icu:AxoPasswordField.Reveal'),
      'AxoTextField.Clear': i18n('icu:AxoTextField.Clear'),
      'AxoContactName.InSystemContactsLabel': i18n('icu:contactInAddressBook'),
    };

    return (
      <StrictMode>
        <AxoProvider
          resolvedAppLocale={resolvedAppLocale}
          systemPreferredLanguages={systemPreferredLanguages}
          messages={messages}
        >
          {props.children}
        </AxoProvider>
      </StrictMode>
    );
  }
);
