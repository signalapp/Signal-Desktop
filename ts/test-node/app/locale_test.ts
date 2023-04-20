// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { stub } from 'sinon';
import { load } from '../../../app/locale';

describe('locale', async () => {
  describe('load', () => {
    it('resolves expected locales correctly', async () => {
      async function testCase(
        preferredSystemLocales: Array<string>,
        expectedLocale: string
      ) {
        const actualLocale = await load({
          preferredSystemLocales,
          logger: {
            fatal: stub().throwsArg(0),
            error: stub().throwsArg(0),
            warn: stub().throwsArg(0),
            info: stub(),
            debug: stub(),
            trace: stub(),
          },
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
      await testCase(['zh-Hant-TW'], 'zh-TW');
      await testCase(['zh-Hant-HK'], 'zh-HK');
      await testCase(['zh'], 'zh-CN');
      await testCase(['yue'], 'yue');
      await testCase(['ug'], 'ug');
      await testCase(['nn', 'nb'], 'nb');
      await testCase(['es-419'], 'es');
    });
  });
});
