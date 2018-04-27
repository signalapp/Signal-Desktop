/*
 * vim: ts=4:sw=4:expandtab
 */

(function() {
  'use strict';
  describe('libphonenumber util', function() {
    describe('parseNumber', function() {
      it('numbers with + are valid without providing regionCode', function() {
        var result = libphonenumber.util.parseNumber('+14155555555');
        assert.isTrue(result.isValidNumber);
        assert.strictEqual(result.nationalNumber, '4155555555');
        assert.strictEqual(result.e164, '+14155555555');
        assert.strictEqual(result.regionCode, 'US');
        assert.strictEqual(result.countryCode, '1');
      });
      it('variant numbers with the right regionCode are valid', function() {
        ['4155555555', '14155555555', '+14155555555'].forEach(function(number) {
          var result = libphonenumber.util.parseNumber(number, 'US');
          assert.isTrue(result.isValidNumber);
          assert.strictEqual(result.nationalNumber, '4155555555');
          assert.strictEqual(result.e164, '+14155555555');
          assert.strictEqual(result.regionCode, 'US');
          assert.strictEqual(result.countryCode, '1');
        });
      });
    });
  });
})();
