// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getPreferredLanguage } from '../../../app/spell_check';

describe('SpellCheck', () => {
  describe('getPreferredLanguage', () => {
    it('works with locale and base available', () => {
      assert.strictEqual(getPreferredLanguage(['en-US'], ['en-US', 'en'], 'en'), 'en-US');
    });

    it('uses icu likely subtags rules to match languages', () => {
      assert.strictEqual(getPreferredLanguage(['fa-FR'], ['fa-IR'], 'en'), 'fa-IR');
      assert.strictEqual(getPreferredLanguage(['zh'], ['zh-Hans-CN'], 'en'), 'zh-Hans-CN');
      assert.strictEqual(getPreferredLanguage(['zh-HK'], ['zh-Hans-CN', 'zh-Hant-HK'], 'en'), 'zh-Hant-HK');
    });

    it('matches the most preferred locale', () => {
      assert.strictEqual(getPreferredLanguage(['fr-FR', 'es'], ['fr', 'es-ES', 'en-US'], 'en'), 'fr');
    });

    it('works with only base locale available', () => {
      assert.strictEqual(getPreferredLanguage(['en-US'], ['en'], 'fr'), 'en');
    });

    it('works with only full locale available', () => {
      assert.strictEqual(getPreferredLanguage(['en-US'], ['en-CA', 'en-US'], 'en'), 'en-US');
    });

    it('works with base provided and base available', () => {
      assert.strictEqual(getPreferredLanguage(['en'], ['en-CA', 'en-US', 'en'], 'fr'), 'en');
    });

    it('falls back to default', () => {
      assert.strictEqual(getPreferredLanguage(['fa-IR'], ['es-ES', 'fr-FR'], 'en'), 'en');
    });

    it('matches the most preferred locale from list', () => {
      assert.strictEqual(getPreferredLanguage(['en', 'fr'], ['fr', 'en'], 'en'), 'en');
    });
  });
});