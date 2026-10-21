// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert, unreachable } from './_internal/assert.std.tsx';

export namespace AxoTokens {
  type HexColor = `#${string}` & { HexColor: never };

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

    type ColorValues = Readonly<{
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

    export function isColorName(color: string): color is ColorName {
      return Object.hasOwn(Colors, color);
    }

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
      // oxlint-disable-next-line typescript/no-non-null-assertion
      return ALL_COLOR_NAMES[hash % ALL_COLOR_NAMES.length]!;
    }

    type GradientValues = Readonly<{
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
      // oxlint-disable-next-line typescript/no-non-null-assertion
      return Gradients[hash % Gradients.length]!;
    }

    export function getGradientsCount(): number {
      return Gradients.length;
    }

    export function gradientToCssBackgroundImage(
      gradient: GradientValues
    ): string {
      return `linear-gradient(to bottom, ${gradient.start}, ${gradient.end})`;
    }

    type ContactPresetName =
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

    type GroupPresetName =
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

  export namespace Contact {
    export type ColorName =
      | '000'
      | '010'
      | '020'
      | '030'
      | '040'
      | '050'
      | '060'
      | '070'
      | '080'
      | '090'
      | '100'
      | '110'
      | '120'
      | '130'
      | '140'
      | '150'
      | '160'
      | '170'
      | '180'
      | '190'
      | '200'
      | '210'
      | '220'
      | '230'
      | '240'
      | '250'
      | '260'
      | '270'
      | '280'
      | '290'
      | '300'
      | '310'
      | '320'
      | '330'
      | '340'
      | '350';

    type ColorValues = Readonly<{
      light: HexColor;
      dark: HexColor;
    }>;

    const Colors: Record<ColorName, ColorValues> = {
      '000': { light: hexColor('#d00b0b'), dark: hexColor('#ff7070') },
      '010': { light: hexColor('#c13215'), dark: hexColor('#ff6f52') },
      '020': { light: hexColor('#b34209'), dark: hexColor('#f57a3d') },
      '030': { light: hexColor('#9c5711'), dark: hexColor('#d5920b') },
      '040': { light: hexColor('#866118'), dark: hexColor('#d68f00') },
      '050': { light: hexColor('#76681e'), dark: hexColor('#b89b0a') },
      '060': { light: hexColor('#6b6b24'), dark: hexColor('#a4a437') },
      '070': { light: hexColor('#5e6e0c'), dark: hexColor('#8faa09') },
      '080': { light: hexColor('#4b7000'), dark: hexColor('#74ad00') },
      '090': { light: hexColor('#3d7406'), dark: hexColor('#5eb309') },
      '100': { light: hexColor('#2d7906'), dark: hexColor('#42b309') },
      '110': { light: hexColor('#2d761e'), dark: hexColor('#43b42d') },
      '120': { light: hexColor('#067906'), dark: hexColor('#0ab80a') },
      '130': { light: hexColor('#32763e'), dark: hexColor('#4baf5c') },
      '140': { light: hexColor('#06792d'), dark: hexColor('#0ab844') },
      '150': { light: hexColor('#007a3d'), dark: hexColor('#00b85c') },
      '160': { light: hexColor('#067953'), dark: hexColor('#00b87a') },
      '170': { light: hexColor('#067462'), dark: hexColor('#09b397') },
      '180': { light: hexColor('#007575'), dark: hexColor('#00b2b2') },
      '190': { light: hexColor('#077288'), dark: hexColor('#00aed1') },
      '200': { light: hexColor('#006da3'), dark: hexColor('#00a7fa') },
      '210': { light: hexColor('#5b6976'), dark: hexColor('#8ba1b6') },
      '220': { light: hexColor('#2662d9'), dark: hexColor('#7da1e8') },
      '230': { light: hexColor('#2e51ff'), dark: hexColor('#8599ff') },
      '240': { light: hexColor('#5151f6'), dark: hexColor('#9494ff') },
      '250': { light: hexColor('#6447f5'), dark: hexColor('#a18ff9') },
      '260': { light: hexColor('#7a3df5'), dark: hexColor('#af8af9') },
      '270': { light: hexColor('#8f2af4'), dark: hexColor('#bf80ff') },
      '280': { light: hexColor('#a20ced'), dark: hexColor('#cf7cf8') },
      '290': { light: hexColor('#af0bd0'), dark: hexColor('#e06ef7') },
      '300': { light: hexColor('#b814b8'), dark: hexColor('#f65af6') },
      '310': { light: hexColor('#c20aa3'), dark: hexColor('#f75fdd') },
      '320': { light: hexColor('#c70a88'), dark: hexColor('#f76ec9') },
      '330': { light: hexColor('#cc0066'), dark: hexColor('#f76eb2') },
      '340': { light: hexColor('#d00b4d'), dark: hexColor('#ff6b9c') },
      '350': { light: hexColor('#d00b2c'), dark: hexColor('#f77389') },
    };

    const ALL_COLOR_NAMES = Object.keys(Colors) as ReadonlyArray<ColorName>;

    export function getColorValues(color: ColorName): ColorValues {
      return assert(Colors[color], `Missing contact color: ${color}`);
    }

    export function getAllColorNames(): ReadonlyArray<ColorName> {
      return ALL_COLOR_NAMES;
    }
  }

  export namespace ChatBubble {
    export type SolidPresetName =
      | 'crimson' // 2
      | 'vermilion' // 3
      | 'burlap' // 4
      | 'forest' // 5
      | 'wintergreen' // 6
      | 'teal' // 7
      | 'blue' // 8
      | 'indigo' // 9
      | 'violet' // 10
      | 'plum' // 11
      | 'taupe' // 12
      | 'steel'; // 13

    export type GradientPresetName =
      | 'ultramarine' // 1
      | 'ember' // 14
      | 'midnight' // 15
      | 'infrared' // 16
      | 'lagoon' // 17
      | 'fluorescent' // 18
      | 'basil' // 19
      | 'sublime' // 20
      | 'sea' // 21
      | 'tangerine'; // 22

    export type Solid = HexColor;

    export type Gradient = Readonly<{
      deg: number;
      start: HexColor;
      end: HexColor;
    }>;

    const SolidPresets: Record<SolidPresetName, HexColor> = {
      crimson: hexColor('#cf163e'),
      vermilion: hexColor('#c73f0a'),
      burlap: hexColor('#6f6a58'),
      forest: hexColor('#3b7845'),
      wintergreen: hexColor('#1d8663'),
      teal: hexColor('#077d92'),
      blue: hexColor('#336ba3'),
      indigo: hexColor('#6058ca'),
      violet: hexColor('#9932c8'),
      plum: hexColor('#aa377a'),
      taupe: hexColor('#8f616a'),
      steel: hexColor('#71717f'),
    };

    const ALL_SOLID_PRESET_NAMES = Object.keys(
      SolidPresets
    ) as ReadonlyArray<SolidPresetName>;

    export function isSolidPresetName(name: string): name is SolidPresetName {
      return Object.hasOwn(SolidPresets, name);
    }

    export function getSolidPresetValue(name: SolidPresetName): HexColor {
      return assert(SolidPresets[name], `Missing solid preset: ${name}`);
    }

    export function getAllSolidPresetNames(): ReadonlyArray<SolidPresetName> {
      return ALL_SOLID_PRESET_NAMES;
    }

    export const Gradients: Record<GradientPresetName, Gradient> = {
      ultramarine: {
        deg: 180,
        start: hexColor('#0552f0'),
        end: hexColor('#2c6bed'),
      },
      basil: {
        deg: 180,
        start: hexColor('#2f9373'),
        end: hexColor('#077343'),
      },
      ember: {
        deg: 168,
        start: hexColor('#e57c00'),
        end: hexColor('#5e0000'),
      },
      fluorescent: {
        deg: 192,
        start: hexColor('#ec13dd'),
        end: hexColor('#1b36c6'),
      },
      infrared: {
        deg: 192,
        start: hexColor('#f65560'),
        end: hexColor('#442ced'),
      },
      lagoon: {
        deg: 180,
        start: hexColor('#004066'),
        end: hexColor('#32867d'),
      },
      midnight: {
        deg: 180,
        start: hexColor('#2c2c3a'),
        end: hexColor('#787891'),
      },
      sea: {
        deg: 180,
        start: hexColor('#498fd4'),
        end: hexColor('#2c66a0'),
      },
      sublime: {
        deg: 180,
        start: hexColor('#6281d5'),
        end: hexColor('#974460'),
      },
      tangerine: {
        deg: 192,
        start: hexColor('#db7133'),
        end: hexColor('#911231'),
      },
    };

    export function isGradientPresetName(
      name: string
    ): name is GradientPresetName {
      return Object.hasOwn(Gradients, name);
    }

    export function getGradientPresetValues(
      name: GradientPresetName
    ): Gradient {
      return assert(Gradients[name], `Missing chat gradrient: ${name}`);
    }

    export function gradientToCssBackgroundImage(gradient: Gradient): string {
      return `linear-gradient(${gradient.deg}deg, ${gradient.start}, ${gradient.end})`;
    }

    export function anyColorNameToCssBackground(
      name: SolidPresetName | GradientPresetName
    ): string {
      if (isSolidPresetName(name)) {
        return getSolidPresetValue(name);
      }
      if (isGradientPresetName(name)) {
        return gradientToCssBackgroundImage(getGradientPresetValues(name));
      }
      unreachable(name);
    }
  }
}
