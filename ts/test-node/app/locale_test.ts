// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { stub } from 'sinon';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import { load, _getAvailableLocales } from '../../../app/locale';
import { FAKE_DEFAULT_LOCALE } from '../../../app/spell_check';
import { HourCyclePreference } from '../../types/I18N';

describe('locale', async () => {
  describe('load', () => {
    it('resolves expected locales correctly', async () => {
      const logger = {
        fatal: stub().throwsArg(0),
        error: stub().throwsArg(0),
        warn: stub().throwsArg(0),
        info: stub(),
        debug: stub(),
        trace: stub(),
      };

      async function testCase(
        preferredSystemLocales: Array<string>,
        expectedLocale: string
      ) {
        const actualLocale = await load({
          preferredSystemLocales,
          localeOverride: null,
          localeDirectionTestingOverride: null,
          hourCyclePreference: HourCyclePreference.UnknownPreference,
          logger,
        });
        assert.strictEqual(actualLocale.name, expectedLocale);
      }

      // Basic tests
      await testCase(['en'], 'en');
      await testCase(['es'], 'es');
      await testCase(['fr', 'hk'], 'fr');
      await testCase(['fr-FR', 'hk'], 'fr');
      await testCase(['fa-UK'], 'fa-IR');
      await testCase(['an', 'fr-FR'], 'fr'); // If we ever add support for Aragonese, this test will fail.

      // Specific cases we want to ensure work as expected
      await testCase(['zh-TW'], 'zh-Hant');
      await testCase(['zh-Hant-TW'], 'zh-Hant');
      await testCase(['zh-Hant-CA'], 'zh-Hant');
      await testCase(['zh-Hant-HK'], 'zh-HK');
      await testCase(['zh'], 'zh-CN');
      await testCase(['yue'], 'yue');
      await testCase(['ug'], 'ug');
      await testCase(['nn', 'nb'], 'nb');
      await testCase(['es-419'], 'es');
      await testCase(['sr-RO', 'sr'], 'sr');
      await testCase(['sr-RS', 'sr'], 'sr');
    });
  });

  describe('Intl.LocaleMatcher', () => {
    it('should work for single locales outside of their region', () => {
      // Our supported locales where we only have a single region for a language
      const SINGLE_REGION_LOCALES = [
        'af-ZA',
        'az-AZ',
        'bg-BG',
        'bn-BD',
        'bs-BA',
        'et-EE',
        'fa-IR',
        'ga-IE',
        'gl-ES',
        'gu-IN',
        'hi-IN',
        'hr-HR',
        'ka-GE',
        'kk-KZ',
        'km-KH',
        'kn-IN',
        'ky-KG',
        'lt-LT',
        'lv-LV',
        'mk-MK',
        'ml-IN',
        'mr-IN',
        'pa-IN',
        'ro-RO',
        'sk-SK',
        'sl-SI',
        'sq-AL',
        'ta-IN',
        'te-IN',
        'tl-PH',
        'uk-UA',
      ];

      // Just a whole bunch of common regions
      const TEST_REGIONS = [
        'AE',
        'AR',
        'AT',
        'AU',
        'BE',
        'CA',
        'CH',
        'CL',
        'CN',
        'CO',
        'CR',
        'CZ',
        'DE',
        'DK',
        'DO',
        'EC',
        'EG',
        'ES',
        'FI',
        'FR',
        'GB',
        'GR',
        'GT',
        'HK',
        'IE',
        'IL',
        'IN',
        'IT',
        'JP',
        'KR',
        'MY',
        'NL',
        'NO',
        'PA',
        'PE',
        'PH',
        'PL',
        'PT',
        'RO',
        'RS',
        'RU',
        'SA',
        'SE',
        'SG',
        'SK',
        'TH',
        'TR',
        'UA',
        'US',
        'VE',
      ];

      const availableLocales = _getAvailableLocales();

      for (const locale of SINGLE_REGION_LOCALES) {
        const { language } = new Intl.Locale(locale);
        for (const region of TEST_REGIONS) {
          const newLocale = new Intl.Locale(language, { region });

          const matched = LocaleMatcher.match(
            [newLocale.baseName],
            availableLocales,
            FAKE_DEFAULT_LOCALE,
            { algorithm: 'best fit' }
          );

          assert.strictEqual(
            matched,
            locale,
            `${locale} -> ${language} -> ${region} -> ${newLocale.baseName} -> ${matched}`
          );
        }
      }
    });
  });
});
