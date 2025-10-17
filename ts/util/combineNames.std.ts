// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

// We don't include unicode-12.1.0 because it's over 100MB in size

// From https://github.com/mathiasbynens/unicode-12.1.0/tree/master/Block

const CJK_Compatibility = /[\u3300-\u33FF]/;
const CJK_Compatibility_Forms = /[\uFE30-\uFE4F]/;
const CJK_Compatibility_Ideographs = /[\uF900-\uFAFF]/;
const CJK_Compatibility_Ideographs_Supplement = /\uD87E[\uDC00-\uDE1F]/;
const CJK_Radicals_Supplement = /[\u2E80-\u2EFF]/;
const CJK_Strokes = /[\u31C0-\u31EF]/;
const CJK_Symbols_And_Punctuation = /[\u3000-\u303F]/;
const CJK_Unified_Ideographs = /[\u4E00-\u9FFF]/;
const CJK_Unified_Ideographs_Extension_A = /[\u3400-\u4DBF]/;
const CJK_Unified_Ideographs_Extension_B =
  /[\uD840-\uD868][\uDC00-\uDFFF]|\uD869[\uDC00-\uDEDF]/;
const CJK_Unified_Ideographs_Extension_C =
  /\uD869[\uDF00-\uDFFF]|[\uD86A-\uD86C][\uDC00-\uDFFF]|\uD86D[\uDC00-\uDF3F]/;
const CJK_Unified_Ideographs_Extension_D =
  /\uD86D[\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1F]/;
const CJK_Unified_Ideographs_Extension_E =
  /\uD86E[\uDC20-\uDFFF]|[\uD86F-\uD872][\uDC00-\uDFFF]|\uD873[\uDC00-\uDEAF]/;
const Enclosed_CJK_Letters_And_Months = /[\u3200-\u32FF]/;
const Kangxi_Radicals = /[\u2F00-\u2FDF]/;
const Ideographic_Description_Characters = /[\u2FF0-\u2FFF]/;
const Hiragana = /[\u3040-\u309F]/;
const Katakana = /[\u30A0-\u30FF]/;
const Katakana_Phonetic_Extensions = /[\u31F0-\u31FF]/;
const Hangul_Compatibility_Jamo = /[\u3130-\u318F]/;
const Hangul_Jamo = /[\u1100-\u11FF]/;
const Hangul_Jamo_Extended_A = /[\uA960-\uA97F]/;
const Hangul_Jamo_Extended_B = /[\uD7B0-\uD7FF]/;
const Hangul_Syllables = /[\uAC00-\uD7AF]/;

// From https://github.com/mathiasbynens/unicode-12.1.0/tree/master/Binary_Property/Ideographic
const isIdeographic =
  /[\u3006\u3007\u3021-\u3029\u3038-\u303A\u3400-\u4DB5\u4E00-\u9FEF\uF900-\uFA6D\uFA70-\uFAD9]|[\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD821[\uDC00-\uDFF7]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDD70-\uDEFB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;

export function combineNames(
  given?: string,
  family?: string
): undefined | string {
  if (!given && !family) {
    return undefined;
  }

  if (!given) {
    return family;
  }

  // Users who haven't upgraded to dual-name, or went minimal, will just have a given name
  if (!family) {
    return given;
  }

  if (isAllCKJV(family) && isAllCKJV(given)) {
    return `${family}${given}`;
  }

  return `${given} ${family}`;
}

function isAllCKJV(name: string): boolean {
  for (const codePoint of name) {
    if (!isCKJV(codePoint)) {
      return false;
    }
  }

  return true;
}

function isCKJV(codePoint: string) {
  if (codePoint === ' ') {
    return true;
  }

  return (
    CJK_Compatibility.test(codePoint) ||
    CJK_Compatibility_Forms.test(codePoint) ||
    CJK_Compatibility_Ideographs.test(codePoint) ||
    CJK_Compatibility_Ideographs_Supplement.test(codePoint) ||
    CJK_Radicals_Supplement.test(codePoint) ||
    CJK_Strokes.test(codePoint) ||
    CJK_Symbols_And_Punctuation.test(codePoint) ||
    CJK_Unified_Ideographs.test(codePoint) ||
    CJK_Unified_Ideographs_Extension_A.test(codePoint) ||
    CJK_Unified_Ideographs_Extension_B.test(codePoint) ||
    CJK_Unified_Ideographs_Extension_C.test(codePoint) ||
    CJK_Unified_Ideographs_Extension_D.test(codePoint) ||
    CJK_Unified_Ideographs_Extension_E.test(codePoint) ||
    Enclosed_CJK_Letters_And_Months.test(codePoint) ||
    Kangxi_Radicals.test(codePoint) ||
    Ideographic_Description_Characters.test(codePoint) ||
    Hiragana.test(codePoint) ||
    Katakana.test(codePoint) ||
    Katakana_Phonetic_Extensions.test(codePoint) ||
    Hangul_Compatibility_Jamo.test(codePoint) ||
    Hangul_Jamo.test(codePoint) ||
    Hangul_Jamo_Extended_A.test(codePoint) ||
    Hangul_Jamo_Extended_B.test(codePoint) ||
    Hangul_Syllables.test(codePoint) ||
    isIdeographic.test(codePoint)
  );
}
