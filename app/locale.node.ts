// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import lodash from 'lodash';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import { setupI18n } from '../ts/util/setupI18nMain.std.ts';
import { shouldNeverBeCalled } from '../ts/util/shouldNeverBeCalled.std.ts';

import type { LoggerType } from '../ts/types/Logging.std.ts';
import type {
  HourCyclePreference,
  LocaleMessagesType,
} from '../ts/types/I18N.std.ts';
import type { LocalizerType } from '../ts/types/Util.std.ts';

const { merge } = lodash;

type CompactLocaleMessagesType = ReadonlyArray<string | null>;
type CompactLocaleKeysType = ReadonlyArray<string>;

function getLocaleMessages(
  rootDir: string,
  locale: string
): LocaleMessagesType {
  const targetFile = join(rootDir, '_locales', locale, 'messages.json');

  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

function getCompactLocaleKeys(rootDir: string): CompactLocaleKeysType {
  const targetFile = join(rootDir, '_locales', 'keys.json');
  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

function getCompactLocaleValues(
  rootDir: string,
  locale: string
): CompactLocaleMessagesType {
  const targetFile = join(rootDir, '_locales', locale, 'values.json');

  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

export type LocaleDisplayNames = Record<string, Record<string, string>>;
export type CountryDisplayNames = Record<string, Record<string, string>>;

function getLocaleDisplayNames(rootDir: string): LocaleDisplayNames {
  const targetFile = join(rootDir, 'build', 'locale-display-names.json');
  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

function getCountryDisplayNames(rootDir: string): CountryDisplayNames {
  const targetFile = join(rootDir, 'build', 'country-display-names.json');
  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

export type LocaleDirection = 'ltr' | 'rtl';

export type LocaleType = {
  availableLocales: Array<string>;
  i18n: LocalizerType;
  name: string;
  direction: LocaleDirection;
  messages: LocaleMessagesType;
  hourCyclePreference: HourCyclePreference;
  localeDisplayNames: LocaleDisplayNames;
  countryDisplayNames: CountryDisplayNames;
};

function getLocaleDirection(localeName: string): LocaleDirection {
  return new Intl.Locale(localeName).getTextInfo().direction ?? 'ltr';
}

export function _getAvailableLocales(rootDir: string): Array<string> {
  return JSON.parse(
    readFileSync(join(rootDir, 'build', 'available-locales.json'), 'utf-8')
  ) as Array<string>;
}

export function load({
  rootDir,
  hourCyclePreference,
  isPackaged,
  localeDirectionTestingOverride,
  localeOverride,
  logger,
  preferredSystemLocales,
}: {
  rootDir: string;
  hourCyclePreference: HourCyclePreference;
  isPackaged: boolean;
  localeDirectionTestingOverride: LocaleDirection | null;
  localeOverride: string | null;
  logger: LoggerType;
  preferredSystemLocales: Array<string>;
}): LocaleType {
  if (preferredSystemLocales == null) {
    throw new TypeError('locale: `preferredSystemLocales` is required');
  }

  if (preferredSystemLocales.length === 0) {
    logger.warn('locale: `preferredSystemLocales` was empty');
  }

  const availableLocales = _getAvailableLocales(rootDir);

  logger.info('locale: Supported locales:', availableLocales.join(', '));
  logger.info('locale: Preferred locales:', preferredSystemLocales.join(', '));
  logger.info('locale: Locale Override:', localeOverride);

  const matchedLocale = LocaleMatcher.match(
    localeOverride != null ? [localeOverride] : preferredSystemLocales,
    availableLocales,
    'en',
    { algorithm: 'best fit' }
  );

  logger.info(`locale: Matched locale: ${matchedLocale}`);

  const localeDisplayNames = getLocaleDisplayNames(rootDir);
  const countryDisplayNames = getCountryDisplayNames(rootDir);

  let finalMessages: LocaleMessagesType;
  if (isPackaged) {
    const matchedLocaleMessages = getCompactLocaleValues(
      rootDir,
      matchedLocale
    );
    const englishMessages = getCompactLocaleValues(rootDir, 'en');
    const keys = getCompactLocaleKeys(rootDir);
    if (matchedLocaleMessages.length !== keys.length) {
      throw new Error(
        `Invalid "${matchedLocale}" entry count, ` +
          `${matchedLocaleMessages.length} != ${keys.length}`
      );
    }
    if (englishMessages.length !== keys.length) {
      throw new Error(
        `Invalid "en" entry count, ${englishMessages.length} != ${keys.length}`
      );
    }

    // We start with english, then overwrite that with anything present in locale
    finalMessages = Object.create(null);
    for (const [i, key] of keys.entries()) {
      finalMessages[key] = {
        messageformat:
          matchedLocaleMessages[i] ?? englishMessages[i] ?? undefined,
      };
    }
  } else {
    const matchedLocaleMessages = getLocaleMessages(rootDir, matchedLocale);
    const englishMessages = getLocaleMessages(rootDir, 'en');

    // We start with english, then overwrite that with anything present in locale
    finalMessages = merge(englishMessages, matchedLocaleMessages);
  }

  const i18n = setupI18n(matchedLocale, finalMessages, {
    renderEmojify: shouldNeverBeCalled,
    getLocaleDirection: shouldNeverBeCalled,
    getHourCyclePreference: shouldNeverBeCalled,
  });
  const direction =
    localeDirectionTestingOverride ?? getLocaleDirection(matchedLocale);
  logger.info(`locale: Text info direction for ${matchedLocale}: ${direction}`);

  return {
    availableLocales,
    i18n,
    name: matchedLocale,
    direction,
    messages: finalMessages,
    hourCyclePreference,
    localeDisplayNames,
    countryDisplayNames,
  };
}
