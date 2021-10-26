// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { readFileSync } from 'fs';
import { merge } from 'lodash';
import { setupI18n } from '../ts/util/setupI18n';

import type { LoggerType } from '../ts/types/Logging';
import type { LocaleMessagesType } from '../ts/types/I18N';
import type { LocalizerType } from '../ts/types/Util';

function normalizeLocaleName(locale: string): string {
  if (/^en-/.test(locale)) {
    return 'en';
  }

  return locale;
}

function getLocaleMessages(locale: string): LocaleMessagesType {
  const onDiskLocale = locale.replace('-', '_');

  const targetFile = join(
    __dirname,
    '..',
    '_locales',
    onDiskLocale,
    'messages.json'
  );

  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

export type LocaleType = {
  i18n: LocalizerType;
  name: string;
  messages: LocaleMessagesType;
};

export function load({
  appLocale,
  logger,
}: {
  appLocale: string;
  logger: LoggerType;
}): LocaleType {
  if (!appLocale) {
    throw new TypeError('`appLocale` is required');
  }

  if (!logger || !logger.error) {
    throw new TypeError('`logger.error` is required');
  }

  const english = getLocaleMessages('en');

  // Load locale - if we can't load messages for the current locale, we
  // default to 'en'
  //
  // possible locales:
  // https://github.com/electron/electron/blob/master/docs/api/locales.md
  let localeName = normalizeLocaleName(appLocale);
  let messages;

  try {
    messages = getLocaleMessages(localeName);

    // We start with english, then overwrite that with anything present in locale
    messages = merge(english, messages);
  } catch (e) {
    logger.error(
      `Problem loading messages for locale ${localeName} ${e.stack}`
    );
    logger.error('Falling back to en locale');

    localeName = 'en';
    messages = english;
  }

  const i18n = setupI18n(appLocale, messages);

  return {
    i18n,
    name: localeName,
    messages,
  };
}
