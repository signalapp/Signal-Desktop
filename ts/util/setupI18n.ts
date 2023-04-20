// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoize from '@formatjs/fast-memoize';
import type { IntlShape } from 'react-intl';
import { createIntl, createIntlCache } from 'react-intl';
import type { LocaleMessageType, LocaleMessagesType } from '../types/I18N';
import type { LocalizerType, ReplacementValuesType } from '../types/Util';
import * as log from '../logging/log';
import { strictAssert } from './assert';

export const formatters = {
  getNumberFormat: memoize((locale, opts) => {
    return new Intl.NumberFormat(locale, opts);
  }),
  getDateTimeFormat: memoize((locale, opts) => {
    return new Intl.DateTimeFormat(locale, opts);
  }),
  getPluralRules: memoize((locale, opts) => {
    return new Intl.PluralRules(locale, opts);
  }),
};

export function isLocaleMessageType(
  value: unknown
): value is LocaleMessageType {
  return (
    typeof value === 'object' &&
    value != null &&
    (Object.hasOwn(value, 'message') || Object.hasOwn(value, 'messageformat'))
  );
}

export function classifyMessages(messages: LocaleMessagesType): {
  icuMessages: Record<string, string>;
  legacyMessages: Record<string, string>;
} {
  const icuMessages: Record<string, string> = {};
  const legacyMessages: Record<string, string> = {};

  for (const [key, value] of Object.entries(messages)) {
    if (isLocaleMessageType(value)) {
      if (value.messageformat != null) {
        icuMessages[key] = value.messageformat;
      } else if (value.message != null) {
        legacyMessages[key] = value.message;
      }
    }
  }

  return { icuMessages, legacyMessages };
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
    },
    intlCache
  );
  return intl;
}

export function formatIcuMessage(
  intl: IntlShape,
  id: string,
  substitutions: ReplacementValuesType | undefined
): string {
  strictAssert(
    !Array.isArray(substitutions),
    `substitutions must be an object for ICU message ${id}`
  );
  const result = intl.formatMessage({ id }, substitutions);
  strictAssert(
    typeof result === 'string',
    'i18n: formatted translation result must be a string, must use <Intl/> component to render JSX'
  );
  return result;
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

  const { icuMessages, legacyMessages } = classifyMessages(messages);
  const intl = createCachedIntl(locale, icuMessages);

  const getMessage: LocalizerType = (key, substitutions) => {
    const messageformat = icuMessages[key];

    if (messageformat != null) {
      return formatIcuMessage(intl, key, substitutions);
    }

    const message = legacyMessages[key];
    if (message == null) {
      log.error(
        `i18n: Attempted to get translation for nonexistent key '${key}'`
      );
      return '';
    }

    if (Array.isArray(substitutions) && substitutions.length > 1) {
      throw new Error(
        'Array syntax is not supported with more than one placeholder'
      );
    }
    if (
      typeof substitutions === 'string' ||
      typeof substitutions === 'number'
    ) {
      throw new Error('You must provide either a map or an array');
    }
    if (!substitutions) {
      return message;
    }
    if (Array.isArray(substitutions)) {
      return substitutions.reduce(
        (result, substitution) => result.replace(/\$.+?\$/, substitution),
        message
      );
    }

    const FIND_REPLACEMENTS = /\$([^$]+)\$/g;

    let match = FIND_REPLACEMENTS.exec(message);
    let builder = '';
    let lastTextIndex = 0;

    while (match) {
      if (lastTextIndex < match.index) {
        builder += message.slice(lastTextIndex, match.index);
      }

      const placeholderName = match[1];
      let value = substitutions[placeholderName];
      if (value == null) {
        log.error(
          `i18n: Value not provided for placeholder ${placeholderName} in key '${key}'`
        );
        value = '';
      }
      builder += value;

      lastTextIndex = FIND_REPLACEMENTS.lastIndex;
      match = FIND_REPLACEMENTS.exec(message);
    }

    if (lastTextIndex < message.length) {
      builder += message.slice(lastTextIndex);
    }

    return builder;
  };

  getMessage.getIntl = () => {
    return intl;
  };
  getMessage.isLegacyFormat = (key: string) => {
    return legacyMessages[key] != null;
  };
  getMessage.getLocale = () => locale;
  getMessage.getLocaleMessages = () => messages;
  getMessage.getLocaleDirection = () => {
    return window.getResolvedMessagesLocaleDirection();
  };

  return getMessage;
}
