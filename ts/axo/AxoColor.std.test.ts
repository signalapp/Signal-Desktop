// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { AxoColor } from './AxoColor.std.ts';

describe('AxoColor', () => {
  describe('parse', () => {
    test('parses hex colors', () => {
      expect(AxoColor.parse('#f00').css()).toBe('rgba(255, 0, 0, 1)');
      expect(AxoColor.parse('#00ff00').css()).toBe('rgba(0, 255, 0, 1)');
    });

    test('parses hsl colors', () => {
      expect(AxoColor.parse('hsl(90, 100%, 30%)').css()).toBe(
        'hsla(90, 100%, 30%, 1)'
      );
    });
  });

  describe('hsl', () => {
    test('preserves hsl channels', () => {
      expect(AxoColor.parse('hsl(340, 70%, 43.33%)').hsl()).toStrictEqual({
        hue: 340,
        saturation: 70,
        lightness: 43.33,
      });
    });

    test('converts other color spaces to hsl', () => {
      expect(AxoColor.parse('#f00').hsl()).toStrictEqual({
        hue: 0,
        saturation: 100,
        lightness: 50,
      });
    });
  });

  describe('fromHSL', () => {
    test('round trips through hsl()', () => {
      const hsl = AxoColor.parse('hsl(197, 100%, 35.66%)').hsl();
      const color = AxoColor.fromHSL(hsl);
      expect(color.css()).toBe('hsla(197, 100%, 35.66%, 1)');
      expect(color.hsl()).toStrictEqual(hsl);
    });
  });

  describe('argbInt', () => {
    test('includes the alpha channel', () => {
      expect(AxoColor.parse('#ff0000').argbInt()).toBe(0xff_ff_00_00);
      expect(AxoColor.parse('#0000ff').argbInt()).toBe(0xff_00_00_ff);
      expect(AxoColor.parse('#ff000080').argbInt()).toBe(0x80_ff_00_00);
    });
  });

  describe('fromARGBInt', () => {
    test('parses ARGB ints', () => {
      expect(
        AxoColor.fromARGBInt(0xff_ff_00_00 as AxoColor.ARGBInt).css()
      ).toBe('rgba(255, 0, 0, 1)');
    });

    test('handles leading zero channels', () => {
      expect(
        AxoColor.fromARGBInt(0xff_00_00_ff as AxoColor.ARGBInt).css()
      ).toBe('rgba(0, 0, 255, 1)');
    });

    test('round trips through argbInt()', () => {
      const input = 0xff_12_34_56 as AxoColor.ARGBInt;
      expect(AxoColor.fromARGBInt(input).argbInt()).toBe(input);
    });
  });
});
