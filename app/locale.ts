// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { readFileSync } from 'fs';
import { merge } from 'lodash';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import { z } from 'zod';
import { setupI18n } from '../ts/util/setupI18n';

import type { LoggerType } from '../ts/types/Logging';
import type { LocaleMessagesType } from '../ts/types/I18N';
import type { LocalizerType } from '../ts/types/Util';
import * as Errors from '../ts/types/errors';

const TextInfoSchema = z.object({
  direction: z.enum(['ltr', 'rtl']),
});

function getLocaleMessages(locale: string): LocaleMessagesType {
  const targetFile = join(__dirname, '..', '_locales', locale, 'messages.json');

  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

export type LocaleDirection = 'ltr' | 'rtl';

export type LocaleType = {
  i18n: LocalizerType;
  name: string;
  direction: LocaleDirection;
  messages: LocaleMessagesType;
};

function getLocaleDirection(
  localeName: string,
  logger: LoggerType
): LocaleDirection {
  const locale = new Intl.Locale(localeName);
  // TC39 proposal is now `locale.getTextInfo()` but in browsers its currently
  // `locale.textInfo`
  try {
    // @ts-expect-error -- TS doesn't know about this method
    if (typeof locale.getTextInfo === 'function') {
      return TextInfoSchema.parse(
        // @ts-expect-error -- TS doesn't know about this method
        locale.getTextInfo()
      ).direction;
    }
    // @ts-expect-error -- TS doesn't know about this property
    if (typeof locale.textInfo === 'object') {
      return TextInfoSchema.parse(
        // @ts-expect-error -- TS doesn't know about this property
        locale.textInfo
      ).direction;
    }
  } catch (error) {
    logger.error(
      'locale: Error getting text info for locale',
      Errors.toLogFormat(error)
    );
  }
  return 'ltr';
}

function finalize(
  messages: LocaleMessagesType,
  backupMessages: LocaleMessagesType,
  localeName: string,
  logger: LoggerType
) {
  // We start with english, then overwrite that with anything present in locale
  const finalMessages = merge(backupMessages, messages);

  const i18n = setupI18n(localeName, finalMessages);

  const direction = getLocaleDirection(localeName, logger);
  logger.info(`locale: Text info direction for ${localeName}: ${direction}`);

  return {
    i18n,
    name: localeName,
    direction,
    messages: finalMessages,
  };
}

export function _getAvailableLocales(): Array<string> {
  return JSON.parse(
    readFileSync(
      join(__dirname, '..', 'build', 'available-locales.json'),
      'utf-8'
    )
  ) as Array<string>;
}

export function load({
  preferredSystemLocales,
  logger,
}: {
  preferredSystemLocales: Array<string>;
  logger: LoggerType;
}): LocaleType {
  if (preferredSystemLocales == null) {
    throw new TypeError('locale: `preferredSystemLocales` is required');
  }

  if (preferredSystemLocales.length === 0) {
    logger.warn('locale: `preferredSystemLocales` was empty');
  }

  const availableLocales = _getAvailableLocales();

  logger.info('locale: Supported locales:', availableLocales.join(', '));
  logger.info('locale: Preferred locales: ', preferredSystemLocales.join(', '));

  const matchedLocale = LocaleMatcher.match(
    preferredSystemLocales,
    availableLocales,
    'en',
    { algorithm: 'best fit' }
  );

  logger.info(`locale: Matched locale: ${matchedLocale}`);

  const matchedLocaleMessages = getLocaleMessages(matchedLocale);
  const englishMessages = getLocaleMessages('en');

  return finalize(
    matchedLocaleMessages,
    englishMessages,
    matchedLocale,
    logger
  );
}
