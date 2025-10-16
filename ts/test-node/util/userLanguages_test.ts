// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  formatAcceptLanguageHeader,
  getUserLanguages,
} from '../../util/userLanguages.std.js';

describe('user language utilities', () => {
  describe('formatAcceptLanguageHeader', () => {
    it('returns * if no languages are provided', () => {
      assert.strictEqual(formatAcceptLanguageHeader([]), '*');
    });

    it('formats one provided language', () => {
      assert.strictEqual(formatAcceptLanguageHeader(['en-US']), 'en-US');
    });

    it('formats three provided languages', () => {
      assert.strictEqual(
        formatAcceptLanguageHeader('abc'.split('')),
        'a, b;q=0.9, c;q=0.8'
      );
    });

    it('formats 10 provided languages', () => {
      assert.strictEqual(
        formatAcceptLanguageHeader('abcdefghij'.split('')),
        'a, b;q=0.9, c;q=0.8, d;q=0.7, e;q=0.6, f;q=0.5, g;q=0.4, h;q=0.3, i;q=0.2, j;q=0.1'
      );
    });

    it('formats 11 provided languages', () => {
      assert.strictEqual(
        formatAcceptLanguageHeader('abcdefghijk'.split('')),
        'a, b;q=0.9, c;q=0.8, d;q=0.7, e;q=0.6, f;q=0.5, g;q=0.4, h;q=0.3, i;q=0.2, j;q=0.1, k;q=0.09'
      );
    });

    it('formats 19 provided languages', () => {
      assert.strictEqual(
        formatAcceptLanguageHeader('abcdefghijklmnopqrs'.split('')),
        'a, b;q=0.9, c;q=0.8, d;q=0.7, e;q=0.6, f;q=0.5, g;q=0.4, h;q=0.3, i;q=0.2, j;q=0.1, k;q=0.09, l;q=0.08, m;q=0.07, n;q=0.06, o;q=0.05, p;q=0.04, q;q=0.03, r;q=0.02, s;q=0.01'
      );
    });

    it('formats 20 provided languages', () => {
      assert.strictEqual(
        formatAcceptLanguageHeader('abcdefghijklmnopqrst'.split('')),
        'a, b;q=0.9, c;q=0.8, d;q=0.7, e;q=0.6, f;q=0.5, g;q=0.4, h;q=0.3, i;q=0.2, j;q=0.1, k;q=0.09, l;q=0.08, m;q=0.07, n;q=0.06, o;q=0.05, p;q=0.04, q;q=0.03, r;q=0.02, s;q=0.01, t;q=0.009'
      );
    });

    it('only formats the first 28 languages', () => {
      const result = formatAcceptLanguageHeader(
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      );
      assert.include(result, 'B;q=0.001');
      assert.notInclude(result, 'C');
      assert.notInclude(result, 'D');
      assert.notInclude(result, 'E');
      assert.notInclude(result, 'Z');
    });
  });

  describe('getUserLanguages', () => {
    it('returns the fallback if no languages are provided', () => {
      assert.deepEqual(getUserLanguages([], 'fallback'), ['fallback']);
      assert.deepEqual(getUserLanguages(undefined, 'fallback'), ['fallback']);
    });

    it('returns the provided languages', () => {
      assert.deepEqual(getUserLanguages(['a', 'b', 'c'], 'x'), ['a', 'b', 'c']);
    });
  });
});
