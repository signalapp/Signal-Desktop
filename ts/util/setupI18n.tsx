// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { IntlShape } from 'react-intl';
import { createIntl, createIntlCache } from 'react-intl';
import type { LocaleMessageType, LocaleMessagesType } from '../types/I18N';
import type { LocalizerType } from '../types/Util';
import { strictAssert } from './assert';
import { Emojify } from '../components/conversation/Emojify';

export function isLocaleMessageType(
  value: unknown
): value is LocaleMessageType {
  return (
    typeof value === 'object' &&
    value != null &&
    Object.hasOwn(value, 'messageformat')
  );
}

function filterLegacyMessages(
  messages: LocaleMessagesType
): Record<string, string> {
  const icuMessages: Record<string, string> = {};

  for (const [key, value] of Object.entries(messages)) {
    if (isLocaleMessageType(value) && value.messageformat != null) {
      icuMessages[key] = value.messageformat;
    }
  }

  return icuMessages;
}

export function renderEmojify(parts: ReadonlyArray<unknown>): JSX.Element {
  strictAssert(parts.length === 1, '<emojify> must contain only one child');
  const text = parts[0];
  strictAssert(typeof text === 'string', '<emojify> must contain only text');
  return <Emojify text={text} />;
}

export function createCachedIntl(
  locale: string,
  icuMessages: Record<string, string>
): IntlShape {
  const intlCache = createIntlCache();
  const intl = createIntl(
    {
      locale: locale.replace('_', '-'), // normalize supported locales to browser format
      messages: icuMessages,
      defaultRichTextElements: {
        emojify: renderEmojify,
      },
    },
    intlCache
  );
  return intl;
}

export function setupI18n(
  locale: string,
  messages: LocaleMessagesType
): LocalizerType {
  if (!locale) {
    throw new Error('i18n: locale parameter is required');
  }
  if (!messages) {
    throw new Error('i18n: messages parameter is required');
  }

  const intl = createCachedIntl(locale, filterLegacyMessages(messages));

  const localizer: LocalizerType = (key, substitutions) => {
    strictAssert(
      !localizer.isLegacyFormat(key),
      `i18n: Legacy message format is no longer supported "${key}"`
    );

    strictAssert(
      !Array.isArray(substitutions),
      `i18n: Substitutions must be an object for ICU message "${key}"`
    );

    const result = intl.formatMessage({ id: key }, substitutions);

    strictAssert(
      typeof result === 'string',
      'i18n: Formatted translation result must be a string, must use <Intl/> component to render JSX'
    );

    strictAssert(result !== key, `i18n: missing translation for "${key}"`);

    return result;
  };

  localizer.getIntl = () => {
    return intl;
  };
  localizer.isLegacyFormat = (key: string) => {
    return !key.startsWith('icu:');
  };
  localizer.getLocale = () => locale;
  localizer.getLocaleMessages = () => messages;
  localizer.getLocaleDirection = () => {
    return window.getResolvedMessagesLocaleDirection();
  };
  localizer.getHourCyclePreference = () => {
    return window.getHourCyclePreference();
  };

  return localizer;
}
