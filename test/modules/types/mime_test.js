const { assert } = require('chai');

const MIME = require('../../../ts/types/MIME');


describe('MIME', () => {
  describe('isJPEG', () => {
    it('should return true for `image/jpeg`', () => {
      assert.isTrue(MIME.isJPEG('image/jpeg'));
    });

    [
      'jpg',
      'jpeg',
      'image/jpg', // invalid MIME type: https://stackoverflow.com/a/37266399/125305
      'image/gif',
      'image/tiff',
      'application/json',
      0,
      false,
      null,
      undefined,
    ]
      .forEach((value) => {
        it(`should return false for \`${value}\``, () => {
          assert.isFalse(MIME.isJPEG(value));
        });
      });
  });
});
