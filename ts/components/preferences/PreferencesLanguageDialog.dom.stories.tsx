// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { PreferencesLanguageDialog } from './PreferencesLanguageDialog.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Preferences/PreferencesLanguageDialog',
} satisfies Meta;

const PREFERRED_SYSTEM_LOCALES: ReadonlyArray<string> = ['en-US'];

export function SystemLanguage(): ReactNode {
  return (
    <PreferencesLanguageDialog
      i18n={i18n}
      resolvedLocale="en"
      preferredSystemLocales={PREFERRED_SYSTEM_LOCALES}
      localeOverride={null}
      onLocaleChange={action('onLocaleChange')}
      onClose={action('onClose')}
    />
  );
}

export function LanguageOverride(): ReactNode {
  return (
    <PreferencesLanguageDialog
      i18n={i18n}
      resolvedLocale="de"
      preferredSystemLocales={PREFERRED_SYSTEM_LOCALES}
      localeOverride="de"
      onLocaleChange={action('onLocaleChange')}
      onClose={action('onClose')}
    />
  );
}
