// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { readFileSync } from 'fs';
import { merge } from 'lodash';
import { setupI18n } from '../ts/util/setupI18n';

import type { LoggerType } from '../ts/types/Logging';
import type { LocaleMessagesType } from '../ts/types/I18N';
import type { LocalizerType } from '../ts/types/Util';

function removeRegion(locale: string): string {
  const match = /^([^-]+)(-.+)$/.exec(locale);
  if (match) {
    return match[1];
  }

  return locale;
}

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
  logger: Pick<LoggerType, 'error' | 'warn' | 'info'>;
}): LocaleType {
  if (preferredSystemLocales == null) {
    throw new TypeError('`preferredSystemLocales` is required');
  }

  if (!logger || !logger.error) {
    throw new TypeError('`logger.error` is required');
  }
  if (!logger.warn) {
    throw new TypeError('`logger.warn` is required');
  }

  if (preferredSystemLocales.length === 0) {
    logger.warn('`preferredSystemLocales` was empty');
  }

  const english = getLocaleMessages('en');

  for (const locale of preferredSystemLocales) {
    try {
      logger.info(`Loading preferred system locale: '${locale}'`);
      return finalize(getLocaleMessages(locale), english, locale);
    } catch (e) {
      logger.warn(
        `Problem loading messages for locale '${locale}', ${e.toString()}`
      );
    }

    const languageOnly = removeRegion(locale);
    try {
      logger.warn(`Falling back to parent language: '${languageOnly}'`);
      // Note: messages are from parent language, but we still keep the region
      return finalize(getLocaleMessages(languageOnly), english, locale);
    } catch (e) {
      logger.error(
        `Problem loading messages for parent locale '${languageOnly}'`
      );
    }
  }

  logger.warn("Falling back to 'en' locale");
  return finalize(english, english, 'en');
}
