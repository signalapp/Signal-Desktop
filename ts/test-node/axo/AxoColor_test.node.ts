// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { AxoColor } from '../../axo/AxoColor.std.ts';

describe('AxoColor', () => {
  describe('parse', () => {
    it('parses hex colors', () => {
      assert.equal(AxoColor.parse('#f00').css(), 'rgba(255, 0, 0, 1)');
      assert.equal(AxoColor.parse('#00ff00').css(), 'rgba(0, 255, 0, 1)');
    });

    it('parses hsl colors', () => {
      assert.equal(
        AxoColor.parse('hsl(90, 100%, 30%)').css(),
        'hsla(90, 100%, 30%, 1)'
      );
    });
  });

  describe('hsl', () => {
    it('preserves hsl channels', () => {
      assert.deepEqual(AxoColor.parse('hsl(340, 70%, 43.33%)').hsl(), {
        hue: 340,
        saturation: 70,
        lightness: 43.33,
      });
    });

    it('converts other color spaces to hsl', () => {
      assert.deepEqual(AxoColor.parse('#f00').hsl(), {
        hue: 0,
        saturation: 100,
        lightness: 50,
      });
    });
  });

  describe('fromHSL', () => {
    it('round trips through hsl()', () => {
      const hsl = AxoColor.parse('hsl(197, 100%, 35.66%)').hsl();
      const color = AxoColor.fromHSL(hsl);
      assert.equal(color.css(), 'hsla(197, 100%, 35.66%, 1)');
      assert.deepEqual(color.hsl(), hsl);
    });
  });

  describe('argbInt', () => {
    it('includes the alpha channel', () => {
      assert.equal(AxoColor.parse('#ff0000').argbInt(), 0xff_ff_00_00);
      assert.equal(AxoColor.parse('#0000ff').argbInt(), 0xff_00_00_ff);
      assert.equal(AxoColor.parse('#ff000080').argbInt(), 0x80_ff_00_00);
    });
  });

  describe('fromARGBInt', () => {
    it('parses ARGB ints', () => {
      assert.equal(
        AxoColor.fromARGBInt(0xff_ff_00_00 as AxoColor.ARGBInt).css(),
        'rgba(255, 0, 0, 1)'
      );
    });

    it('handles leading zero channels', () => {
      assert.equal(
        AxoColor.fromARGBInt(0xff_00_00_ff as AxoColor.ARGBInt).css(),
        'rgba(0, 0, 255, 1)'
      );
    });

    it('round trips through argbInt()', () => {
      const input = 0xff_12_34_56 as AxoColor.ARGBInt;
      assert.equal(AxoColor.fromARGBInt(input).argbInt(), input);
    });
  });
});
