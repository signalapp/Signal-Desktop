/* global libphonenumber */

'use strict';

describe('libphonenumber util', () => {
  describe('parseNumber', () => {
    it('numbers with + are valid without providing regionCode', () => {
      const result = libphonenumber.util.parseNumber('+14155555555');
      assert.isTrue(result.isValidNumber);
      assert.strictEqual(result.nationalNumber, '4155555555');
      assert.strictEqual(result.e164, '+14155555555');
      assert.strictEqual(result.regionCode, 'US');
      assert.strictEqual(result.countryCode, '1');
    });
    it('variant numbers with the right regionCode are valid', () => {
      ['4155555555', '14155555555', '+14155555555'].forEach(number => {
        const result = libphonenumber.util.parseNumber(number, 'US');
        assert.isTrue(result.isValidNumber);
        assert.strictEqual(result.nationalNumber, '4155555555');
        assert.strictEqual(result.e164, '+14155555555');
        assert.strictEqual(result.regionCode, 'US');
        assert.strictEqual(result.countryCode, '1');
      });
    });
  });
});
