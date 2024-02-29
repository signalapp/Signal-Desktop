// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { IntlShape } from 'react-intl';
import { createIntl, createIntlCache } from 'react-intl';
import type { LocaleMessageType, LocaleMessagesType } from '../types/I18N';
import type { LocalizerType, ReplacementValuesType } from '../types/Util';
import { strictAssert } from './assert';
import { Emojify } from '../components/conversation/Emojify';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { Environment, getEnvironment } from '../environment';
import { bidiIsolate } from './unicodeBidi';

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

function normalizeSubstitutions(
  substitutions?: ReplacementValuesType
): ReplacementValuesType | undefined {
  if (!substitutions) {
    return;
  }
  const normalized: ReplacementValuesType = {};
  for (const [key, value] of Object.entries(substitutions)) {
    if (typeof value === 'string') {
      normalized[key] = bidiIsolate(value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
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

    const result = intl.formatMessage(
      { id: key },
      normalizeSubstitutions(substitutions)
    );

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
    return window.SignalContext.getResolvedMessagesLocaleDirection();
  };
  localizer.getHourCyclePreference = () => {
    return window.SignalContext.getHourCyclePreference();
  };

  return localizer;
}
