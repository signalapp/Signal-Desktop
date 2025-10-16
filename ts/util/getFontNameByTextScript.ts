// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util.std.js';
import { strictAssert } from './assert.std.js';

const FONT_MAP = {
  base: [
    'sans-serif',
    'sans-serif',
    'sans-serif',
    'serif',
    'serif',
    'sans-serif',
  ],
  latin: [
    'Inter',
    'Inter',
    'Inter',
    '"EB Garamond"',
    'Parisienne',
    '"Barlow Condensed"',
  ],
  cyrillic: [
    'Inter',
    'Inter',
    'Inter',
    '"EB Garamond"',
    '"American Typewriter Semibold", "Cambria Bold"',
    '"SF Pro Light (System Light)", "Calibri Light"',
  ],
  devanagari: [
    '"Kohinoor Devanagari Regular", "Utsaah Regular"',
    '"Kohinoor Devanagari Regular", "Utsaah Regular"',
    '"Kohinoor Devanagari Semibold", "Utsaah Bold"',
    '"Devanagari Sangam MN Regular", "Kokila Regular"',
    '"Devanagari Sangam MN Bold", "Kokila Bold"',
    '"Kohinoor Devanagari Light", "Utsaah Regular"',
  ],
  arabic: [
    '"SF Arabic Regular", "Segoe UI Arabic Regular"',
    '"SF Arabic Regular", "Segoe UI Arabic Regular"',
    '"SF Arabic Bold", "Segoe UI Arabic Bold"',
    '"Geeza Pro Regular", "Sakkal Majalla Regular"',
    '"Geeza Pro Bold", "Sakkal Majalla Bold"',
    '"SF Arabic Black", "Segoe UI Arabic Bold"',
  ],
  japanese: [
    '"Hiragino Sans W3"',
    '"Hiragino Sans W3"',
    '"Hiragino Sans W7"',
    '"Hiragino Mincho Pro W3"',
    '"Hiragino Mincho Pro W6"',
    '"Hiragino Maru Gothic Pro N"',
  ],
  zhhk: [
    '"PingFang HK Regular", "MingLiU Regular"',
    '"PingFang HK Regular", "MingLiU Regular"',
    '"PingFang HK Semibold", "MingLiU Regular"',
    '"PingFang HK Ultralight", "MingLiU Regular"',
    '"PingFang HK Thin", "MingLiU Regular"',
    '"PingFang HK Light", "MingLiU Regular"',
  ],
  zhtc: [
    '"PingFang TC Regular", "JhengHei TC Regular"',
    '"PingFang TC Regular", "JhengHei TC Regular"',
    '"PingFang TC Semibold", "JhengHei TC Bold"',
    '"PingFang TC Ultralight", "JhengHei TC Light"',
    '"PingFang TC Thin", "JhengHei TC Regular"',
    '"PingFang TC Light", "JhengHei TC Bold"',
  ],
  zhsc: [
    '"PingFang SC Regular", SimHei',
    '"PingFang SC Regular", SimHei',
    '"PingFang SC Semibold", SimHei',
    '"PingFang SC Ultralight", SimHei',
    '"PingFang SC Thin", SimHei',
    '"PingFang SC Light", SimHei',
  ],
};

const rxArabic = /\p{Script=Arab}/u;
const rxCJK = /\p{Script=Han}/u;
const rxCyrillic = /\p{Script=Cyrl}/u;
const rxDevanagari = /\p{Script=Deva}/u;
const rxJapanese = /\p{Script=Hira}|\p{Script=Kana}/u;
const rxLatin = /\p{Script=Latn}/u;

export const fontSniffer = {
  hasArabic(text: string): boolean {
    return rxArabic.test(text);
  },

  hasCJK(text: string): boolean {
    return rxCJK.test(text);
  },

  hasCyrillic(text: string): boolean {
    return rxCyrillic.test(text);
  },

  hasDevanagari(text: string): boolean {
    return rxDevanagari.test(text);
  },

  hasJapanese(text: string): boolean {
    return rxJapanese.test(text);
  },

  hasLatin(text: string): boolean {
    return rxLatin.test(text);
  },
};

export function getFontNameByTextScript(
  text: string,
  textStyleIndex: number,
  i18n?: LocalizerType
): string {
  strictAssert(
    textStyleIndex >= 0 && textStyleIndex <= 5,
    'text style is not between 0-5'
  );

  const fonts: Array<string> = [FONT_MAP.base[textStyleIndex]];

  if (fontSniffer.hasArabic(text)) {
    fonts.push(FONT_MAP.arabic[textStyleIndex]);
  }

  if (fontSniffer.hasCJK(text)) {
    const locale = i18n?.getLocale();

    if (locale === 'zh-TW') {
      fonts.push(FONT_MAP.zhtc[textStyleIndex]);
    } else if (locale === 'zh-HK') {
      fonts.push(FONT_MAP.zhhk[textStyleIndex]);
    } else {
      fonts.push(FONT_MAP.zhsc[textStyleIndex]);
    }
  }

  if (fontSniffer.hasCyrillic(text)) {
    fonts.push(FONT_MAP.cyrillic[textStyleIndex]);
  }

  if (fontSniffer.hasDevanagari(text)) {
    fonts.push(FONT_MAP.devanagari[textStyleIndex]);
  }

  if (fontSniffer.hasJapanese(text)) {
    fonts.push(FONT_MAP.japanese[textStyleIndex]);
  }

  if (fontSniffer.hasLatin(text)) {
    fonts.push(FONT_MAP.latin[textStyleIndex]);
  }

  return fonts.reverse().join(', ');
}
