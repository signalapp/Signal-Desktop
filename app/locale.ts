// Copyright 2017-2022 Signal Messenger, LLC
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
  appLocale,
  logger,
}: {
  appLocale: string;
  logger: Pick<LoggerType, 'error' | 'warn'>;
}): LocaleType {
  if (!appLocale) {
    throw new TypeError('`appLocale` is required');
  }

  if (!logger || !logger.error) {
    throw new TypeError('`logger.error` is required');
  }
  if (!logger.warn) {
    throw new TypeError('`logger.warn` is required');
  }

  const english = getLocaleMessages('en');

  // Load locale - if we can't load messages for the current locale, we
  // default to 'en'
  //
  // possible locales:
  // https://source.chromium.org/chromium/chromium/src/+/main:ui/base/l10n/l10n_util.cc
  const normalized = removeRegion(appLocale);

  try {
    return finalize(getLocaleMessages(appLocale), english, appLocale);
  } catch (e) {
    logger.warn(`Problem loading messages for locale ${appLocale}`);
  }

  try {
    logger.warn(`Falling back to parent language: '${normalized}'`);
    // Note: messages are from parent language, but we still keep the region
    return finalize(getLocaleMessages(normalized), english, appLocale);
  } catch (e) {
    logger.error(`Problem loading messages for locale ${normalized}`);

    logger.warn("Falling back to 'en' locale");
    return finalize(english, english, 'en');
  }
}
