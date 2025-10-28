// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert, AssertionError } from 'chai';
import { parseNumber } from '../../util/libphonenumberUtil.std.js';

describe('libphonenumber util', () => {
  describe('parseNumber', () => {
    it('numbers with + are valid without providing regionCode', () => {
      const result = parseNumber('+14155555555');
      if (!result.isValidNumber) {
        throw new AssertionError('Phone number is not valid');
      }
      assert.strictEqual(result.e164, '+14155555555');
      assert.strictEqual(result.regionCode, 'US');
      assert.strictEqual(result.countryCode, '1');
    });
    it('variant numbers with the right regionCode are valid', () => {
      ['4155555555', '14155555555', '+14155555555'].forEach(number => {
        const result = parseNumber(number, 'US');
        if (!result.isValidNumber) {
          throw new AssertionError('Phone number is not valid');
        }
        assert.strictEqual(result.e164, '+14155555555');
        assert.strictEqual(result.regionCode, 'US');
        assert.strictEqual(result.countryCode, '1');
      });
    });
  });
});
