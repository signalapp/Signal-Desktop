// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from './_internal/assert.std.js';

export namespace AxoTokens {
  export type HexColor = `#${string}` & { HexColor: never };

  function hexColor(input: `#${string}`): HexColor {
    return input as HexColor;
  }

  export namespace Avatar {
    export type ColorName =
      | 'A100'
      | 'A110'
      | 'A120'
      | 'A130'
      | 'A140'
      | 'A150'
      | 'A160'
      | 'A170'
      | 'A180'
      | 'A190'
      | 'A200'
      | 'A210';

    export type ColorValues = Readonly<{
      bg: HexColor;
      fg: HexColor;
    }>;

    const Colors: Record<ColorName, ColorValues> = {
      A100: { bg: hexColor('#e3e3fe'), fg: hexColor('#3838f5') },
      A110: { bg: hexColor('#dde7fc'), fg: hexColor('#1251d3') },
      A120: { bg: hexColor('#d8e8f0'), fg: hexColor('#086da0') },
      A130: { bg: hexColor('#cde4cd'), fg: hexColor('#067906') },
      A140: { bg: hexColor('#eae0fd'), fg: hexColor('#661aff') },
      A150: { bg: hexColor('#f5e3fe'), fg: hexColor('#9f00f0') },
      A160: { bg: hexColor('#f6d8ec'), fg: hexColor('#b8057c') },
      A170: { bg: hexColor('#f5d7d7'), fg: hexColor('#be0404') },
      A180: { bg: hexColor('#fef5d0'), fg: hexColor('#836b01') },
      A190: { bg: hexColor('#eae6d5'), fg: hexColor('#7d6f40') },
      A200: { bg: hexColor('#d2d2dc'), fg: hexColor('#4f4f6d') },
      A210: { bg: hexColor('#d7d7d9'), fg: hexColor('#5c5c5c') },
    };

    const ALL_COLOR_NAMES = Object.keys(Colors) as ReadonlyArray<ColorName>;

    export function getColorValues(color: ColorName): ColorValues {
      return assert(Colors[color], `Missing avatar color: ${color}`);
    }

    export function getAllColorNames(): ReadonlyArray<ColorName> {
      return ALL_COLOR_NAMES;
    }

    export function getColorNameByHash(hash: number): ColorName {
      assert(
        Number.isInteger(hash) && hash >= 0,
        'Hash must be positive integer'
      );
      return ALL_COLOR_NAMES[hash % ALL_COLOR_NAMES.length];
    }

    export type GradientValues = Readonly<{
      start: HexColor;
      end: HexColor;
    }>;

    const Gradients: ReadonlyArray<GradientValues> = [
      { start: hexColor('#252568'), end: hexColor('#9C8F8F') },
      { start: hexColor('#2A4275'), end: hexColor('#9D9EA1') },
      { start: hexColor('#2E4B5F'), end: hexColor('#8AA9B1') },
      { start: hexColor('#2E426C'), end: hexColor('#7A9377') },
      { start: hexColor('#1A341A'), end: hexColor('#807F6E') },
      { start: hexColor('#464E42'), end: hexColor('#D5C38F') },
      { start: hexColor('#595643'), end: hexColor('#93A899') },
      { start: hexColor('#2C2F36'), end: hexColor('#687466') },
      { start: hexColor('#2B1E18'), end: hexColor('#968980') },
      { start: hexColor('#7B7067'), end: hexColor('#A5A893') },
      { start: hexColor('#706359'), end: hexColor('#BDA194') },
      { start: hexColor('#383331'), end: hexColor('#A48788') },
      { start: hexColor('#924F4F'), end: hexColor('#897A7A') },
      { start: hexColor('#663434'), end: hexColor('#C58D77') },
      { start: hexColor('#8F4B02'), end: hexColor('#AA9274') },
      { start: hexColor('#784747'), end: hexColor('#8C8F6F') },
      { start: hexColor('#747474'), end: hexColor('#ACACAC') },
      { start: hexColor('#49484C'), end: hexColor('#A5A6B5') },
      { start: hexColor('#4A4E4D'), end: hexColor('#ABAFAE') },
      { start: hexColor('#3A3A3A'), end: hexColor('#929887') },
    ];

    export function getGradientValuesByHash(hash: number): GradientValues {
      assert(
        Number.isInteger(hash) && hash >= 0,
        'Hash must be positive integer'
      );
      return Gradients[hash % Gradients.length];
    }

    export function getGradientsCount(): number {
      return Gradients.length;
    }

    export function gradientToCssBackgroundImage(
      gradient: GradientValues
    ): string {
      return `linear-gradient(to bottom, ${gradient.start}, ${gradient.end})`;
    }

    export type ContactPresetName =
      | 'abstract_01'
      | 'abstract_02'
      | 'abstract_03'
      | 'cat'
      | 'dog'
      | 'fox'
      | 'tucan'
      | 'pig'
      | 'dinosour'
      | 'sloth'
      | 'incognito'
      | 'ghost';

    export type GroupPresetName =
      | 'balloon'
      | 'book'
      | 'briefcase'
      | 'celebration'
      | 'drink'
      | 'football'
      | 'heart'
      | 'house'
      | 'melon'
      | 'soccerball'
      | 'sunset'
      | 'surfboard';

    export type PresetName = ContactPresetName | GroupPresetName;

    const ContactPresetColors: Record<ContactPresetName, ColorName> = {
      abstract_01: 'A130',
      abstract_02: 'A120',
      abstract_03: 'A170',
      cat: 'A190',
      dog: 'A140',
      fox: 'A190',
      tucan: 'A120',
      pig: 'A160',
      dinosour: 'A130',
      sloth: 'A180',
      incognito: 'A210',
      ghost: 'A100',
    };

    const GroupPresetColors: Record<GroupPresetName, ColorName> = {
      balloon: 'A180',
      book: 'A120',
      briefcase: 'A110',
      celebration: 'A170',
      drink: 'A100',
      football: 'A210',
      heart: 'A100',
      house: 'A180',
      melon: 'A120',
      soccerball: 'A110',
      sunset: 'A130',
      surfboard: 'A210',
    };

    const PresetColors = { ...ContactPresetColors, ...GroupPresetColors };

    export function getAllContactPresetNames(): ReadonlyArray<ContactPresetName> {
      return Object.keys(
        ContactPresetColors
      ) as ReadonlyArray<ContactPresetName>;
    }

    export function getAllGroupPresetNames(): ReadonlyArray<GroupPresetName> {
      return Object.keys(GroupPresetColors) as ReadonlyArray<GroupPresetName>;
    }

    export function getPresetColorName(preset: PresetName): ColorName {
      return assert(PresetColors[preset], `Missing avatar preset: ${preset}`);
    }
  }
}
