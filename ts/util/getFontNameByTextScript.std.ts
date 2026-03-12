// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { TextAttachmentStyleType } from '../types/Attachment.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { strictAssert } from './assert.std.js';

const TextStyle = TextAttachmentStyleType;

const FONT_MAP = {
  base: {
    [TextStyle.DEFAULT]: 'sans-serif',
    [TextStyle.REGULAR]: 'sans-serif',
    [TextStyle.BOLD]: 'sans-serif',
    [TextStyle.SERIF]: 'serif',
    [TextStyle.SCRIPT]: 'serif',
    [TextStyle.CONDENSED]: 'sans-serif',
  },
  latin: {
    [TextStyle.DEFAULT]: 'Inter',
    [TextStyle.REGULAR]: 'Inter',
    [TextStyle.BOLD]: 'Inter',
    [TextStyle.SERIF]: '"EB Garamond"',
    [TextStyle.SCRIPT]: 'Parisienne',
    [TextStyle.CONDENSED]: '"Barlow Condensed"',
  },
  cyrillic: {
    [TextStyle.DEFAULT]: 'Inter',
    [TextStyle.REGULAR]: 'Inter',
    [TextStyle.BOLD]: 'Inter',
    [TextStyle.SERIF]: '"EB Garamond"',
    [TextStyle.SCRIPT]: '"American Typewriter Semibold", "Cambria Bold"',
    [TextStyle.CONDENSED]: '"SF Pro Light (System Light)", "Calibri Light"',
  },
  devanagari: {
    [TextStyle.DEFAULT]: '"Kohinoor Devanagari Regular", "Utsaah Regular"',
    [TextStyle.REGULAR]: '"Kohinoor Devanagari Regular", "Utsaah Regular"',
    [TextStyle.BOLD]: '"Kohinoor Devanagari Semibold", "Utsaah Bold"',
    [TextStyle.SERIF]: '"Devanagari Sangam MN Regular", "Kokila Regular"',
    [TextStyle.SCRIPT]: '"Devanagari Sangam MN Bold", "Kokila Bold"',
    [TextStyle.CONDENSED]: '"Kohinoor Devanagari Light", "Utsaah Regular"',
  },
  arabic: {
    [TextStyle.DEFAULT]: '"SF Arabic Regular", "Segoe UI Arabic Regular"',
    [TextStyle.REGULAR]: '"SF Arabic Regular", "Segoe UI Arabic Regular"',
    [TextStyle.BOLD]: '"SF Arabic Bold", "Segoe UI Arabic Bold"',
    [TextStyle.SERIF]: '"Geeza Pro Regular", "Sakkal Majalla Regular"',
    [TextStyle.SCRIPT]: '"Geeza Pro Bold", "Sakkal Majalla Bold"',
    [TextStyle.CONDENSED]: '"SF Arabic Black", "Segoe UI Arabic Bold"',
  },
  japanese: {
    [TextStyle.DEFAULT]: '"Hiragino Sans W3"',
    [TextStyle.REGULAR]: '"Hiragino Sans W3"',
    [TextStyle.BOLD]: '"Hiragino Sans W7"',
    [TextStyle.SERIF]: '"Hiragino Mincho Pro W3"',
    [TextStyle.SCRIPT]: '"Hiragino Mincho Pro W6"',
    [TextStyle.CONDENSED]: '"Hiragino Maru Gothic Pro N"',
  },
  zhhk: {
    [TextStyle.DEFAULT]: '"PingFang HK Regular", "MingLiU Regular"',
    [TextStyle.REGULAR]: '"PingFang HK Regular", "MingLiU Regular"',
    [TextStyle.BOLD]: '"PingFang HK Semibold", "MingLiU Regular"',
    [TextStyle.SERIF]: '"PingFang HK Ultralight", "MingLiU Regular"',
    [TextStyle.SCRIPT]: '"PingFang HK Thin", "MingLiU Regular"',
    [TextStyle.CONDENSED]: '"PingFang HK Light", "MingLiU Regular"',
  },
  zhtc: {
    [TextStyle.DEFAULT]: '"PingFang TC Regular", "JhengHei TC Regular"',
    [TextStyle.REGULAR]: '"PingFang TC Regular", "JhengHei TC Regular"',
    [TextStyle.BOLD]: '"PingFang TC Semibold", "JhengHei TC Bold"',
    [TextStyle.SERIF]: '"PingFang TC Ultralight", "JhengHei TC Light"',
    [TextStyle.SCRIPT]: '"PingFang TC Thin", "JhengHei TC Regular"',
    [TextStyle.CONDENSED]: '"PingFang TC Light", "JhengHei TC Bold"',
  },
  zhsc: {
    [TextStyle.DEFAULT]: '"PingFang SC Regular", SimHei',
    [TextStyle.REGULAR]: '"PingFang SC Regular", SimHei',
    [TextStyle.BOLD]: '"PingFang SC Semibold", SimHei',
    [TextStyle.SERIF]: '"PingFang SC Ultralight", SimHei',
    [TextStyle.SCRIPT]: '"PingFang SC Thin", SimHei',
    [TextStyle.CONDENSED]: '"PingFang SC Light", SimHei',
  },
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
  textStyleType: TextAttachmentStyleType,
  i18n?: LocalizerType
): string {
  strictAssert(
    TextAttachmentStyleType[textStyleType],
    `Invalid textStyleType: ${textStyleType}`
  );

  const fonts: Array<string> = [FONT_MAP.base[textStyleType]];

  if (fontSniffer.hasArabic(text)) {
    fonts.push(FONT_MAP.arabic[textStyleType]);
  }

  if (fontSniffer.hasCJK(text)) {
    const locale = i18n?.getLocale();

    if (locale === 'zh-TW') {
      fonts.push(FONT_MAP.zhtc[textStyleType]);
    } else if (locale === 'zh-HK') {
      fonts.push(FONT_MAP.zhhk[textStyleType]);
    } else {
      fonts.push(FONT_MAP.zhsc[textStyleType]);
    }
  }

  if (fontSniffer.hasCyrillic(text)) {
    fonts.push(FONT_MAP.cyrillic[textStyleType]);
  }

  if (fontSniffer.hasDevanagari(text)) {
    fonts.push(FONT_MAP.devanagari[textStyleType]);
  }

  if (fontSniffer.hasJapanese(text)) {
    fonts.push(FONT_MAP.japanese[textStyleType]);
  }

  if (fontSniffer.hasLatin(text)) {
    fonts.push(FONT_MAP.latin[textStyleType]);
  }

  return fonts.reverse().join(', ');
}
