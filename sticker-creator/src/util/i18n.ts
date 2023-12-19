// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoize from '@formatjs/fast-memoize';
import type { IntlShape } from 'react-intl';
import { createIntl, createIntlCache } from 'react-intl';
import createDebug from 'debug';

import type {
  ReplacementValuesType,
  LocaleMessageType,
  LocaleMessagesType,
} from '../types.d';
import englishMessages from '../assets/locales/en/messages.json';
import { assert } from './assert';

const debug = createDebug('signal:i18n');

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
  substitutions:
    | ReplacementValuesType<string | number | undefined | JSX.Element>
    | undefined
): string {
  assert(
    !Array.isArray(substitutions),
    `substitutions must be an object for ICU message ${id}`
  );
  const result = intl.formatMessage({ id }, substitutions);
  assert(
    typeof result === 'string',
    'i18n: formatted translation result must be a string, must use <Intl/> component to render JSX'
  );
  return result;
}

export type LoadLocaleResult = Readonly<{
  locale: string;
  messages: LocaleMessagesType;
}>;

export async function loadLocale(
  language = navigator.language
): Promise<LoadLocaleResult> {
  // Remove region. "en-US" might not be supported, but "en" is.
  const languageWithoutRegion = removeRegion(language);

  let messages = englishMessages;
  let locale = 'en';
  if (language !== 'en' && languageWithoutRegion !== 'en') {
    try {
      messages = (await import(`../assets/locales/${language}/messages.json`))
        .default;
      locale = language;
    } catch {
      try {
        messages = (
          await import(
            `../assets/locales/${languageWithoutRegion}/messages.json`
          )
        ).default;
        locale = languageWithoutRegion;
      } catch {
        // Fallback to en
      }
    }
  }

  debug('using %j locale', locale);
  return { locale, messages };
}

function removeRegion(language: string): string {
  const match = /^([^-]+)(-.+)$/.exec(language);
  if (match) {
    return match[1];
  }

  return language;
}
