// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

describe('Helpers', () => {
  describe('ArrayBuffer->String conversion', () => {
    it('works', () => {
      const b = new ArrayBuffer(3);
      const a = new Uint8Array(b);
      a[0] = 0;
      a[1] = 255;
      a[2] = 128;
      assert.equal(window.textsecure.utils.getString(b), '\x00\xff\x80');
    });
  });

  describe('stringToArrayBuffer', () => {
    it('returns ArrayBuffer when passed string', () => {
      const anArrayBuffer = new ArrayBuffer(1);
      const typedArray = new Uint8Array(anArrayBuffer);
      typedArray[0] = 'a'.charCodeAt(0);
      assertEqualArrayBuffers(
        window.textsecure.utils.stringToArrayBuffer('a'),
        anArrayBuffer
      );
    });
    it('throws an error when passed a non string', () => {
      const notStringable = [{}, undefined, null, new ArrayBuffer()];
      notStringable.forEach(notString => {
        assert.throw(() => {
          window.textsecure.utils.stringToArrayBuffer(notString);
        }, Error);
      });
    });
  });
});
