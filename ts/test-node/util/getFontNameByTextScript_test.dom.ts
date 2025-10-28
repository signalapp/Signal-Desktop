// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  fontSniffer,
  getFontNameByTextScript,
} from '../../util/getFontNameByTextScript.std.js';
import { setupI18n } from '../../util/setupI18n.dom.js';

describe('getFontNameByTextScript', () => {
  it('has arabic', () => {
    const text = 'الثعلب البني السريع يقفز فوق الكلب الكسول';
    assert.isTrue(fontSniffer.hasArabic(text), 'arabic');
    assert.isFalse(fontSniffer.hasLatin(text), 'latin');
    assert.isFalse(fontSniffer.hasJapanese(text), 'japanese');
  });

  it('has chinese (simplified)', () => {
    const text = '敏捷的棕色狐狸跳过了懒狗';
    assert.isTrue(fontSniffer.hasCJK(text), 'cjk');
    assert.isFalse(fontSniffer.hasLatin(text), 'latin');
    assert.isFalse(fontSniffer.hasJapanese(text), 'japanese');
  });

  it('has chinese (traditional)', () => {
    const text = '敏捷的棕色狐狸跳過了懶狗';
    assert.isTrue(fontSniffer.hasCJK(text), 'cjk');
    assert.isFalse(fontSniffer.hasLatin(text), 'latin');
    assert.isFalse(fontSniffer.hasJapanese(text), 'japanese');
  });

  it('has cyrillic (Bulgarian)', () => {
    const text = 'Бързата кафява лисица прескача мързеливото куче';
    assert.isFalse(fontSniffer.hasLatin(text), 'latin');
    assert.isTrue(fontSniffer.hasCyrillic(text), 'cyrillic');
    assert.isFalse(fontSniffer.hasArabic(text), 'arabic');
  });

  it('has cyrillic (Ukrainian)', () => {
    const text = 'Швидка бура лисиця стрибає через ледачого пса';
    assert.isFalse(fontSniffer.hasLatin(text), 'latin');
    assert.isTrue(fontSniffer.hasCyrillic(text), 'cyrillic');
    assert.isFalse(fontSniffer.hasArabic(text), 'arabic');
  });

  it('has devanagari', () => {
    const text = 'तेज, भूरी लोमडी आलसी कुत्ते के उपर कूद गई';
    assert.isTrue(fontSniffer.hasDevanagari(text), 'devanagari');
    assert.isFalse(fontSniffer.hasLatin(text), 'latin');
    assert.isFalse(fontSniffer.hasCyrillic(text), 'cyrillic');
  });

  it('has japanese', () => {
    const text = '速い茶色のキツネは怠惰な犬を飛び越えます';
    assert.isFalse(fontSniffer.hasDevanagari(text), 'devanagari');
    assert.isFalse(fontSniffer.hasLatin(text), 'latin');
    assert.isTrue(fontSniffer.hasJapanese(text), 'japanese');
    assert.isTrue(fontSniffer.hasCJK(text), 'cjk');
  });

  it('throws when passing in an invalid text style', () => {
    const text = 'abc';

    assert.throws(() => {
      getFontNameByTextScript(text, -1);
    });

    assert.throws(() => {
      getFontNameByTextScript(text, 99);
    });
  });

  it('returns the correct font names in the right order (japanese)', () => {
    const text = '速い茶色のキツネは怠惰な犬を飛び越えます';

    const actual = getFontNameByTextScript(text, 0);
    const expected =
      '"Hiragino Sans W3", "PingFang SC Regular", SimHei, sans-serif';
    assert.equal(actual, expected);
  });

  it('returns the correct font names in the right order (latin)', () => {
    const text = 'The quick brown fox jumps over the lazy dog';

    const actual = getFontNameByTextScript(text, 0);
    const expected = 'Inter, sans-serif';
    assert.equal(actual, expected);
  });

  it('returns the correct font names (chinese simplified)', () => {
    const text = '敏捷的棕色狐狸跳过了懒狗';

    const actual = getFontNameByTextScript(text, 0, setupI18n('zh-CN', {}));
    const expected = '"PingFang SC Regular", SimHei, sans-serif';
    assert.equal(actual, expected);
  });

  it('returns the correct font names (chinese traditional)', () => {
    const text = '敏捷的棕色狐狸跳過了懶狗';

    const actual = getFontNameByTextScript(text, 0, setupI18n('zh-TW', {}));
    const expected = '"PingFang TC Regular", "JhengHei TC Regular", sans-serif';
    assert.equal(actual, expected);
  });
});
