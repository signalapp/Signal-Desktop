// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getLanguages } from '../../../app/spell_check.main.js';

describe('SpellCheck', () => {
  describe('getLanguages', () => {
    it('works with locale and base available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en-US', 'en'], 'en'), [
        'en-US',
      ]);
    });

    it('uses icu likely subtags rules to match languages', () => {
      assert.deepEqual(getLanguages(['fa-FR'], ['fa-IR'], 'en'), ['fa-IR']);
      assert.deepEqual(getLanguages(['zh'], ['zh-Hans-CN'], 'en'), [
        'zh-Hans-CN',
      ]);
      assert.deepEqual(
        getLanguages(['zh-HK'], ['zh-Hans-CN', 'zh-Hant-HK'], 'en'),
        ['zh-Hant-HK']
      );
    });

    it('matches multiple locales', () => {
      assert.deepEqual(
        getLanguages(['fr-FR', 'es'], ['fr', 'es-ES', 'en-US'], 'en'),
        ['fr', 'es-ES']
      );
    });

    it('works with only base locale available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en'], 'en'), ['en']);
    });

    it('works with only full locale available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en-CA', 'en-US'], 'en'), [
        'en-US',
      ]);
    });

    it('works with base provided and base available', () => {
      assert.deepEqual(getLanguages(['en'], ['en-CA', 'en-US', 'en'], 'en'), [
        'en',
      ]);
    });

    it('falls back to default', () => {
      assert.deepEqual(getLanguages(['fa-IR'], ['es-ES', 'fr-FR'], 'en'), [
        'en',
      ]);
    });

    it('matches en along with other languages', () => {
      assert.deepEqual(getLanguages(['en', 'fr'], ['fr', 'en'], 'en'), [
        'en',
        'fr',
      ]);
    });
  });
});
