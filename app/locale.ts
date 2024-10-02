// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { readFileSync } from 'fs';
import { merge } from 'lodash';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import { z } from 'zod';
import { setupI18n } from '../ts/util/setupI18nMain';
import { shouldNeverBeCalled } from '../ts/util/shouldNeverBeCalled';

import type { LoggerType } from '../ts/types/Logging';
import type { HourCyclePreference, LocaleMessagesType } from '../ts/types/I18N';
import type { LocalizerType } from '../ts/types/Util';
import * as Errors from '../ts/types/errors';
import { parseUnknown } from '../ts/util/schemas';

const TextInfoSchema = z.object({
  direction: z.enum(['ltr', 'rtl']),
});

function getLocaleMessages(locale: string): LocaleMessagesType {
  const targetFile = join(__dirname, '..', '_locales', locale, 'messages.json');

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

  const matchedLocaleMessages = getLocaleMessages(matchedLocale);
  const englishMessages = getLocaleMessages('en');
  const localeDisplayNames = getLocaleDisplayNames();
  const countryDisplayNames = getCountryDisplayNames();

  // We start with english, then overwrite that with anything present in locale
  const finalMessages = merge(englishMessages, matchedLocaleMessages);
  const i18n = setupI18n(matchedLocale, finalMessages, {
    renderEmojify: shouldNeverBeCalled,
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
