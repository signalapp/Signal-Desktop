// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { app } from 'electron';
import lodash from 'lodash';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import { z } from 'zod';
import { setupI18n } from '../ts/util/setupI18nMain.std.js';
import { shouldNeverBeCalled } from '../ts/util/shouldNeverBeCalled.std.js';

import type { LoggerType } from '../ts/types/Logging.std.js';
import type {
  HourCyclePreference,
  LocaleMessagesType,
} from '../ts/types/I18N.std.js';
import type { LocalizerType } from '../ts/types/Util.std.js';
import * as Errors from '../ts/types/errors.std.js';
import { parseUnknown } from '../ts/util/schemas.std.js';

const { merge } = lodash;

type CompactLocaleMessagesType = ReadonlyArray<string | null>;
type CompactLocaleKeysType = ReadonlyArray<string>;

const TextInfoSchema = z.object({
  direction: z.enum(['ltr', 'rtl']),
});

function getLocaleMessages(locale: string): LocaleMessagesType {
  const targetFile = join(__dirname, '..', '_locales', locale, 'messages.json');

  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

function getCompactLocaleKeys(): CompactLocaleKeysType {
  const targetFile = join(__dirname, '..', '_locales', 'keys.json');
  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

function getCompactLocaleValues(locale: string): CompactLocaleMessagesType {
  const targetFile = join(__dirname, '..', '_locales', locale, 'values.json');

  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

export type LocaleDisplayNames = Record<string, Record<string, string>>;
export type CountryDisplayNames = Record<string, Record<string, string>>;

function getLocaleDisplayNames(): LocaleDisplayNames {
  const targetFile = join(
    __dirname,
    '..',
    'build',
    'locale-display-names.json'
  );
  return JSON.parse(readFileSync(targetFile, 'utf-8'));
}

function getCountryDisplayNames(): CountryDisplayNames {
  const targetFile = join(
    __dirname,
    '..',
    'build',
    'country-display-names.json'
  );
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
      return parseUnknown(
        TextInfoSchema,
        // @ts-expect-error -- TS doesn't know about this method
        locale.getTextInfo() as unknown
      ).direction;
    }
    // @ts-expect-error -- TS doesn't know about this property
    if (typeof locale.textInfo === 'object') {
      return parseUnknown(
        TextInfoSchema,
        // @ts-expect-error -- TS doesn't know about this property
        locale.textInfo as unknown
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
  localeOverride,
  localeDirectionTestingOverride,
  hourCyclePreference,
  logger,
}: {
  preferredSystemLocales: Array<string>;
  localeOverride: string | null;
  localeDirectionTestingOverride: LocaleDirection | null;
  hourCyclePreference: HourCyclePreference;
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
  logger.info('locale: Preferred locales:', preferredSystemLocales.join(', '));
  logger.info('locale: Locale Override:', localeOverride);

  const matchedLocale = LocaleMatcher.match(
    localeOverride != null ? [localeOverride] : preferredSystemLocales,
    availableLocales,
    'en',
    { algorithm: 'best fit' }
  );

  logger.info(`locale: Matched locale: ${matchedLocale}`);

  const localeDisplayNames = getLocaleDisplayNames();
  const countryDisplayNames = getCountryDisplayNames();

  let finalMessages: LocaleMessagesType;
  if (app.isPackaged) {
    const matchedLocaleMessages = getCompactLocaleValues(matchedLocale);
    const englishMessages = getCompactLocaleValues('en');
    const keys = getCompactLocaleKeys();
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
    const matchedLocaleMessages = getLocaleMessages(matchedLocale);
    const englishMessages = getLocaleMessages('en');

    // We start with english, then overwrite that with anything present in locale
    finalMessages = merge(englishMessages, matchedLocaleMessages);
  }

  const i18n = setupI18n(matchedLocale, finalMessages, {
    renderEmojify: shouldNeverBeCalled,
    getLocaleDirection: shouldNeverBeCalled,
    getHourCyclePreference: shouldNeverBeCalled,
  });
  const direction =
    localeDirectionTestingOverride ?? getLocaleDirection(matchedLocale, logger);
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
