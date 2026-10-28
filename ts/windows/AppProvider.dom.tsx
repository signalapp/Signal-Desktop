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
      'AxoAlertDialog.Ok': i18n('icu:AxoAlertDialog.Ok'),
      'AxoBadge.MaxOverflow': max => i18n('icu:AxoBadge.MaxOverflow', { max }),
      'AxoButton.Pending': i18n('icu:AxoButton.Pending'),
      'AxoColorSlider.Hue': i18n('icu:AxoColorSlider.Hue'),
      'AxoColorSlider.Saturation': i18n('icu:AxoColorSlider.Saturation'),
      'AxoColorSlider.Lightness': i18n('icu:AxoColorSlider.Lightness'),
      'AxoDialog.Back': i18n('icu:AxoDialog.Back'),
      'AxoDialog.Close': i18n('icu:AxoDialog.Close'),
      'AxoLoadingIndicator.Loading': i18n('icu:AxoLoadingIndicator.Loading'),
      'AxoMediaButton.Play': i18n('icu:AxoMediaButton.Play'),
      'AxoMediaButton.Pause': i18n('icu:AxoMediaButton.Pause'),
      'AxoMediaButton.Download': i18n('icu:AxoMediaButton.Download'),
      'AxoMediaButton.CancelDownload': i18n(
        'icu:AxoMediaButton.CancelDownload'
      ),
      'AxoOutgoingStatus.Sending': i18n('icu:AxoOutgoingStatus.Sending'),
      'AxoOutgoingStatus.Sent': i18n('icu:AxoOutgoingStatus.Sent'),
      'AxoOutgoingStatus.Delivered': i18n('icu:AxoOutgoingStatus.Delivered'),
      'AxoOutgoingStatus.Read': i18n('icu:AxoOutgoingStatus.Read'),
      'AxoOutgoingStatus.Paused': i18n('icu:AxoOutgoingStatus.Paused'),
      'AxoOutgoingStatus.Error': i18n('icu:AxoOutgoingStatus.Error'),
      'AxoPasswordField.Reveal': i18n('icu:AxoPasswordField.Reveal'),
      'AxoProgressIndicator.Loading': i18n('icu:AxoProgressIndicator.Loading'),
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
