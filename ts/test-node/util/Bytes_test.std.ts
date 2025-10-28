// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Bytes from '../../Bytes.std.js';

describe('Bytes', () => {
  it('converts to base64 and back', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const base64 = Bytes.toBase64(bytes);
    assert.strictEqual(base64, 'AQID');

    assert.deepEqual(Bytes.fromBase64(base64), bytes);
  });

  it('converts to hex and back', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    const hex = Bytes.toHex(bytes);
    assert.strictEqual(hex, '010203');

    assert.deepEqual(Bytes.fromHex(hex), bytes);
  });

  it('converts to string and back', () => {
    const bytes = new Uint8Array([0x61, 0x62, 0x63]);

    const binary = Bytes.toString(bytes);
    assert.strictEqual(binary, 'abc');

    assert.deepEqual(Bytes.fromString(binary), bytes);
  });

  it('converts to binary and back', () => {
    const bytes = new Uint8Array([0xff, 0x01]);

    const binary = Bytes.toBinary(bytes);
    assert.strictEqual(binary, '\xff\x01');

    assert.deepEqual(Bytes.fromBinary(binary), bytes);
  });

  it('concatenates bytes', () => {
    const result = Bytes.concatenate([
      Bytes.fromString('hello'),
      Bytes.fromString(' '),
      Bytes.fromString('world'),
    ]);

    assert.strictEqual(Bytes.toString(result), 'hello world');
  });

  describe('isEmpty', () => {
    it('returns true for `undefined`', () => {
      assert.strictEqual(Bytes.isEmpty(undefined), true);
    });

    it('returns true for `null`', () => {
      assert.strictEqual(Bytes.isEmpty(null), true);
    });

    it('returns true for an empty Uint8Array', () => {
      assert.strictEqual(Bytes.isEmpty(new Uint8Array(0)), true);
    });

    it('returns false for not empty Uint8Array', () => {
      assert.strictEqual(Bytes.isEmpty(new Uint8Array(123)), false);
    });
  });

  describe('isNotEmpty', () => {
    it('returns false for `undefined`', () => {
      assert.strictEqual(Bytes.isNotEmpty(undefined), false);
    });

    it('returns false for `null`', () => {
      assert.strictEqual(Bytes.isNotEmpty(null), false);
    });

    it('returns false for an empty Uint8Array', () => {
      assert.strictEqual(Bytes.isNotEmpty(new Uint8Array(0)), false);
    });

    it('returns true for not empty Uint8Array', () => {
      assert.strictEqual(Bytes.isNotEmpty(new Uint8Array(123)), true);
    });
  });
});
