// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { assert } = require('chai');

const { getLanguages } = require('../../app/spell_check');

describe('SpellCheck', () => {
  describe('getLanguages', () => {
    it('works with locale and base available', () => {
      assert.deepEqual(getLanguages('en-US', ['en-US', 'en-CA', 'en']), [
        'en-US',
        'en',
      ]);
    });

    it('works with neither locale nor base available', () => {
      assert.deepEqual(getLanguages('en-US', ['en-NZ', 'en-CA']), [
        'en-NZ',
        'en-CA',
      ]);
    });

    it('works with only base locale available', () => {
      assert.deepEqual(getLanguages('en-US', ['en', 'en-CA']), ['en']);
    });

    it('works with only full locale available', () => {
      assert.deepEqual(getLanguages('en-US', ['en-CA', 'en-US']), ['en-US']);
    });

    it('works with base provided and base available', () => {
      assert.deepEqual(getLanguages('en', ['en-CA', 'en-US', 'en']), ['en']);
    });

    it('works with base provided and base not available', () => {
      assert.deepEqual(getLanguages('en', ['en-CA', 'en-US']), [
        'en-CA',
        'en-US',
      ]);
    });
  });
});
