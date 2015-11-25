/*
 * vim: ts=4:sw=4:expandtab
 */

'use strict';

describe("Helpers", function() {
  describe("ArrayBuffer->String conversion", function() {
      it('works', function() {
          var b = new ArrayBuffer(3);
          var a = new Uint8Array(b);
          a[0] = 0;
          a[1] = 255;
          a[2] = 128;
          assert.equal(getString(b), "\x00\xff\x80");
      });
  });

  describe("toArrayBuffer", function() {
      it('returns undefined when passed undefined', function() {
          assert.strictEqual(toArrayBuffer(undefined), undefined);
      });
      it('returns ArrayBuffer when passed ArrayBuffer', function() {
          var StaticArrayBufferProto = new ArrayBuffer().__proto__;
          var anArrayBuffer = new ArrayBuffer();
          assert.strictEqual(toArrayBuffer(anArrayBuffer), anArrayBuffer);
      });
      it('throws an error when passed a non Stringable thing', function() {
          var madeUpObject = function() {};
          var notStringable = new madeUpObject();
          assert.throw(function() { toArrayBuffer(notStringable) },
                       Error, /Tried to convert a non-stringable thing/);
      });
  });
});
