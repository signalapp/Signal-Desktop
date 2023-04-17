// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { readFileSync } from 'fs';
import { merge } from 'lodash';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import { setupI18n } from '../ts/util/setupI18n';

import type { LoggerType } from '../ts/types/Logging';
import type { LocaleMessagesType } from '../ts/types/I18N';
import type { LocalizerType } from '../ts/types/Util';

function getLocaleMessages(locale: string): LocaleMessagesType {
  const targetFile = join(__dirname, '..', '_locales', locale, 'messages.json');

  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

export type LocaleType = {
  i18n: LocalizerType;
  name: string;
  messages: LocaleMessagesType;
};

function finalize(
  messages: LocaleMessagesType,
  backupMessages: LocaleMessagesType,
  localeName: string
) {
  // We start with english, then overwrite that with anything present in locale
  const finalMessages = merge(backupMessages, messages);

  const i18n = setupI18n(localeName, finalMessages);

  return {
    i18n,
    name: localeName,
    messages: finalMessages,
  };
}

export function load({
  preferredSystemLocales,
  logger,
}: {
  preferredSystemLocales: Array<string>;
  logger: Pick<LoggerType, 'warn' | 'info'>;
}): LocaleType {
  if (preferredSystemLocales == null) {
    throw new TypeError('locale: `preferredSystemLocales` is required');
  }
  if (!logger.info) {
    throw new TypeError('locale: `logger.info` is required');
  }
  if (!logger.warn) {
    throw new TypeError('locale: `logger.warn` is required');
  }

  if (preferredSystemLocales.length === 0) {
    logger.warn('locale: `preferredSystemLocales` was empty');
  }

  const availableLocales = JSON.parse(
    readFileSync(
      join(__dirname, '..', 'build', 'available-locales.json'),
      'utf-8'
    )
  ) as Array<string>;

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

  return finalize(matchedLocaleMessages, englishMessages, matchedLocale);
}
