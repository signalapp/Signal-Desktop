const { assert } = require('chai');

const MIME = require('../../../js/modules/types/mime');


describe('MIME', () => {
  describe('isJPEG', () => {
    it('should return true for `image/jpeg`', () => {
      assert.isTrue(MIME.isJPEG('image/jpeg'));
    });

    it('should return true for `image/jpg`', () => {
      assert.isTrue(MIME.isJPEG('image/jpeg'));
    });

    ['image/gif', 'image/tiff', 'application/json', 0, false, null, undefined]
      .forEach((value) => {
        it(`should return false for \`${value}\``, () => {
          assert.isFalse(MIME.isJPEG(value));
        });
      });
  });
});
