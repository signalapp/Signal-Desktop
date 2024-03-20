import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import { getAppRootPath } from './getRootPath';

function normalizeLocaleName(locale: string) {
  if (/^en-/.test(locale)) {
    return 'en';
  }
  if (/^en_/.test(locale)) {
    return 'en';
  }

  return locale;
}

function getLocaleMessages(locale: string): LocaleMessagesType {
  const onDiskLocale = locale.replace('-', '_');

  const targetFile = path.join(getAppRootPath(), '_locales', onDiskLocale, 'messages.json');

  return JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
}
export type LocaleMessagesType = Record<string, string>;
export type LocaleMessagesWithNameType = { messages: LocaleMessagesType; name: string };

export function load({
  appLocale,
  logger,
}: { appLocale?: string; logger?: any } = {}): LocaleMessagesWithNameType {
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
    messages = _.merge(english, messages);
  } catch (e) {
    logger.error(`Problem loading messages for locale ${localeName} ${e.stack}`);
    logger.error('Falling back to en locale');

    localeName = 'en';
    messages = english;
  }

  return {
    name: localeName,
    messages,
  };
}
