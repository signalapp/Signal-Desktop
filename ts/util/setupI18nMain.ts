// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { IntlShape } from 'react-intl';
import { createIntl, createIntlCache } from 'react-intl';
import type { ReactNode } from 'react';
import type {
  LocaleMessageType,
  LocaleMessagesType,
} from '../types/I18N.std.js';
import type {
  LocalizerType,
  ICUStringMessageParamsByKeyType,
  LocalizerOptions,
} from '../types/Util.std.js';
import { strictAssert } from './assert.std.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { Environment, getEnvironment } from '../environment.std.js';
import { bidiIsolate, bidiStrip } from './unicodeBidi.std.js';

const log = createLogger('setupI18nMain');

export function isLocaleMessageType(
  value: unknown
): value is LocaleMessageType {
  return (
    typeof value === 'object' &&
    value != null &&
    Object.hasOwn(value, 'messageformat')
  );
}

export type SetupI18nOptionsType = Readonly<{
  renderEmojify: (parts: ReadonlyArray<unknown>) => ReactNode;
  getLocaleDirection: LocalizerType['getLocaleDirection'];
  getHourCyclePreference: LocalizerType['getHourCyclePreference'];
}>;

export function createCachedIntl(
  locale: string,
  icuMessages: Record<string, string>,
  { renderEmojify }: SetupI18nOptionsType
): IntlShape {
  const intlCache = createIntlCache();
  const intl = createIntl(
    {
      locale: locale.replace('_', '-'), // normalize supported locales to browser format
      messages: icuMessages,
      defaultRichTextElements: {
        emojify: renderEmojify,
      },
      onError(error) {
        log.error('intl.onError', Errors.toLogFormat(error));
      },
      onWarn(warning) {
        if (
          getEnvironment() === Environment.Test &&
          warning.includes(
            // This warning is very noisy during tests
            '"defaultRichTextElements" was specified but "message" was not pre-compiled.'
          )
        ) {
          return;
        }
        log.warn('intl.onWarn', warning);
      },
    },
    intlCache
  );
  return intl;
}

function normalizeSubstitutions<
  Substitutions extends Record<string, string | number | Date> | undefined,
>(
  substitutions?: Substitutions,
  options?: LocalizerOptions
): Substitutions | undefined {
  if (!substitutions) {
    return;
  }
  const normalized: Record<string, string | number | Date> = {};
  const entries = Object.entries(substitutions);
  if (entries.length === 0) {
    return;
  }
  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      if (options?.bidi === 'strip') {
        normalized[key] = bidiStrip(value);
      } else {
        normalized[key] = bidiIsolate(value);
      }
    } else {
      normalized[key] = value;
    }
  }
  return normalized as Substitutions;
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

export function setupI18n(
  locale: string,
  messages: LocaleMessagesType,
  {
    renderEmojify,
    getLocaleDirection,
    getHourCyclePreference,
  }: SetupI18nOptionsType
): LocalizerType {
  if (!locale) {
    throw new Error('i18n: locale parameter is required');
  }
  if (!messages) {
    throw new Error('i18n: messages parameter is required');
  }

  const intl = createCachedIntl(locale, filterLegacyMessages(messages), {
    renderEmojify,
    getLocaleDirection,
    getHourCyclePreference,
  });

  let usedStrings: Map<string, string> | undefined;

  const localizer: LocalizerType = (<
    Key extends keyof ICUStringMessageParamsByKeyType,
  >(
    key: Key,
    substitutions: ICUStringMessageParamsByKeyType[Key],
    options?: LocalizerOptions
  ) => {
    const result = intl.formatMessage(
      { id: key },
      normalizeSubstitutions(substitutions, options)
    );

    usedStrings?.set(key, result);

    strictAssert(result !== key, `i18n: missing translation for "${key}"`);

    return result;
  }) as LocalizerType;

  localizer.getIntl = () => {
    return intl;
  };
  localizer.getLocale = () => locale;
  localizer.getLocaleMessages = () => messages;
  localizer.getLocaleDirection = getLocaleDirection;
  localizer.getHourCyclePreference = getHourCyclePreference;

  // Storybook
  localizer.trackUsage = () => {
    if (usedStrings !== undefined) {
      throw new Error('Already tracking usage');
    }
    usedStrings = new Map();
  };
  localizer.stopTrackingUsage = () => {
    if (usedStrings === undefined) {
      throw new Error('Not tracking usage');
    }
    const result = Array.from(usedStrings.entries());
    usedStrings = undefined;
    return result;
  };

  return localizer;
}
