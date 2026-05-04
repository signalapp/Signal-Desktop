// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

// Keep this data in sync with:
// https://raw.githubusercontent.com/greyson-signal/emoji-data/457ad4f7a09699ec940b149c8f4e76382bb0aadf/emoji.json
import SRC_EMOJIS from './emoji-datasource/emoji-datasource.json' with { type: 'json' };
import getEmojiRegex from 'emoji-regex-xs';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { assert } from './utils/assert.mjs';

const PRETTY = process.argv.includes('--pretty');

const gzipAsync = promisify(gzip);
const EMOJI_REGEX = getEmojiRegex();

const ROOT_DIR = join(import.meta.dirname, '..');
const EMOJI_DATA_PATH = join(ROOT_DIR, 'build', 'emoji-data.json');

/**
 * @typedef {string & { Emoji: never }} Emoji
 *
 * @typedef {(
 *   | 'SMILIES_AND_PEOPLE'
 *   | 'ANIMALS_AND_NATURE'
 *   | 'FOOD_AND_DRINK'
 *   | 'TRAVEL_AND_PLACES'
 *   | 'ACTIVITIES'
 *   | 'OBJECTS'
 *   | 'SYMBOLS'
 *   | 'FLAGS'
 * )} Category
 *
 * @typedef {(
 *  | '1F3FB'
 *  | '1F3FC'
 *  | '1F3FD'
 *  | '1F3FE'
 *  | '1F3FF'
 * )} SkinTone
 *
 * @typedef {Record<SkinTone, Emoji>} SkinTones
 *
 * @typedef {{
 *   shortName: string;
 *   shortNameAlts?: Array<string>;
 *   emoticon?: string;
 *   emoticonAlts?: Array<string>;
 *   skinTones?: SkinTones;
 * }} EmojiInfo
 *
 * @typedef {Record<Category, Array<Emoji>>} Categories
 * @typedef {Record<Emoji, EmojiInfo>} Emojis
 * @typedef {Record<Emoji, Emoji>} Parents
 *
 * @typedef {{ categories: Categories, emojis: Emojis, parents: Parents }} EmojiData
 */

/** @satisfies {Record<string, Category | null>} */
const CATEGORY_NAME_MAP = {
  'Smileys & Emotion': 'SMILIES_AND_PEOPLE', // merged
  'People & Body': 'SMILIES_AND_PEOPLE', // merged
  Component: null, // dropped
  'Animals & Nature': 'ANIMALS_AND_NATURE',
  'Food & Drink': 'FOOD_AND_DRINK',
  'Travel & Places': 'TRAVEL_AND_PLACES',
  Activities: 'ACTIVITIES',
  Objects: 'OBJECTS',
  Symbols: 'SYMBOLS',
  Flags: 'FLAGS',
};

/** @type {{ [K in SkinTone]: K }} */
const SKIN_TONES = {
  '1F3FB': '1F3FB',
  '1F3FC': '1F3FC',
  '1F3FD': '1F3FD',
  '1F3FE': '1F3FE',
  '1F3FF': '1F3FF',
};

const KNOWN_MISSING_APPLE_IMG = new Set([
  'FEMALE SIGN',
  'MALE SIGN',
  'MEDICAL SYMBOL',
]);

const DEPRECATED_EMOJI = new Set([
  /**
   * 2022 - Family Emoji Redesign: Gender Inclusive Variants
   * https://www.unicode.org/L2/L2023/23029-family-emoji.pdf
   * https://www.unicode.org/L2/L2022/22276-family-emoji-guidelines.pdf
   */
  'FAMILY: MAN, BOY, BOY',
  'FAMILY: MAN, BOY',
  'FAMILY: MAN, GIRL, BOY',
  'FAMILY: MAN, GIRL, GIRL',
  'FAMILY: MAN, GIRL',
  'FAMILY: MAN, MAN, BOY',
  'FAMILY: MAN, MAN, BOY, BOY',
  'FAMILY: MAN, MAN, GIRL',
  'FAMILY: MAN, MAN, GIRL, BOY',
  'FAMILY: MAN, MAN, GIRL, GIRL',
  'FAMILY: MAN, WOMAN, BOY',
  'FAMILY: MAN, WOMAN, BOY, BOY',
  'FAMILY: MAN, WOMAN, GIRL',
  'FAMILY: MAN, WOMAN, GIRL, BOY',
  'FAMILY: MAN, WOMAN, GIRL, GIRL',
  'FAMILY: WOMAN, BOY, BOY',
  'FAMILY: WOMAN, BOY',
  'FAMILY: WOMAN, GIRL, BOY',
  'FAMILY: WOMAN, GIRL, GIRL',
  'FAMILY: WOMAN, GIRL',
  'FAMILY: WOMAN, WOMAN, BOY',
  'FAMILY: WOMAN, WOMAN, BOY, BOY',
  'FAMILY: WOMAN, WOMAN, GIRL',
  'FAMILY: WOMAN, WOMAN, GIRL, BOY',
  'FAMILY: WOMAN, WOMAN, GIRL, GIRL',
]);

/**
 * @param {string} input
 * @returns {input is Emoji}
 */
function isEmoji(input) {
  const match = input.match(EMOJI_REGEX);
  return match != null && match[0] === input;
}

/**
 * @param {string} input
 * @returns {input is keyof typeof CATEGORY_NAME_MAP}
 */
function isCategoryName(input) {
  return Object.hasOwn(CATEGORY_NAME_MAP, input);
}

/**
 * @param {Emoji} emoji
 * @returns {boolean}
 */
function isDeprecated(emoji) {
  return DEPRECATED_EMOJI.has(emoji);
}

/**
 * @param {string} unified
 * @returns {string}
 */
function encodeUnified(unified) {
  return unified
    .split('-')
    .map(char => String.fromCodePoint(Number.parseInt(char, 16)))
    .join('');
}

/**
 * @param {Partial<SkinTones>} skinTones
 * @returns {skinTones is SkinTones}
 */
function hasAllSkinTones(skinTones) {
  return Object.values(SKIN_TONES).every(skinTone => {
    return Object.hasOwn(skinTones, skinTone) && skinTones[skinTone] != null;
  });
}

const SRC_EMOJIS_SORTED = SRC_EMOJIS.toSorted((a, b) => {
  return a.sort_order - b.sort_order;
});

/** @type {Categories} */
const categories = {
  SMILIES_AND_PEOPLE: [],
  ANIMALS_AND_NATURE: [],
  FOOD_AND_DRINK: [],
  TRAVEL_AND_PLACES: [],
  ACTIVITIES: [],
  OBJECTS: [],
  SYMBOLS: [],
  FLAGS: [],
};
/** @type {Emojis} */
const emojis = {};
/** @type {Parents} */
const parents = {};

for (const emojiSrc of SRC_EMOJIS_SORTED) {
  const emojiName = emojiSrc.name;

  const categoryName = emojiSrc.category;
  assert(isCategoryName(categoryName), `Unexpected category: ${categoryName}`);

  const category = CATEGORY_NAME_MAP[categoryName];
  if (category == null) {
    continue; // drop components
  }

  assert(
    emojiSrc.has_img_apple === !KNOWN_MISSING_APPLE_IMG.has(emojiName),
    'Unexpected mismatch between has_img_apple and KNOWN_MISSING_APPLE_IMG'
  );
  if (!emojiSrc.has_img_apple) {
    continue;
  }

  const emoji = encodeUnified(emojiSrc.unified);
  assert(isEmoji(emoji), 'Unexpected invalid emoji');

  if (isDeprecated(emoji)) {
    continue; // drop deprecated emoji
  }

  /** @type {EmojiInfo} */
  const info = {
    shortName: emojiSrc.short_name,
  };

  const shortNameAlts = new Set(emojiSrc.short_names);
  shortNameAlts.delete(emojiSrc.short_name);
  if (shortNameAlts.size !== 0) {
    info.shortNameAlts = Array.from(shortNameAlts);
  }

  if (emojiSrc.text != null) {
    info.emoticon = emojiSrc.text;
  }

  const emoticonAlts = new Set(emojiSrc.texts);
  if (emojiSrc.text != null) {
    emoticonAlts.delete(emojiSrc.text);
  }
  if (emoticonAlts.size !== 0) {
    info.emoticonAlts = Array.from(emoticonAlts);
  }

  if (emojiSrc.skin_variations != null) {
    /** @type {Partial<Record<SkinTone, Emoji>>} */
    const skinTones = {};

    for (const skinTone of Object.values(SKIN_TONES)) {
      const match =
        emojiSrc.skin_variations[skinTone] ??
        emojiSrc.skin_variations[`${skinTone}-${skinTone}`];

      if (match == null) {
        continue;
      }

      const variant = encodeUnified(match.unified);

      assert(match.has_img_apple, 'Unexpected missing apple image');
      assert(isEmoji(variant), 'Unexpected invalid variant');
      assert(!isDeprecated(variant), 'Unexpected deprecated variant');

      skinTones[skinTone] = variant;
    }

    assert(hasAllSkinTones(skinTones), 'Expected to have all skin tones');
    info.skinTones = skinTones;

    for (const skinTone of Object.values(SKIN_TONES)) {
      const variant = info.skinTones[skinTone];
      parents[variant] = emoji;
    }
  }

  categories[category] ??= [];
  categories[category].push(emoji);

  emojis[emoji] = info;
}

/** @type {EmojiData} */
const emojiData = {
  categories,
  emojis,
  parents,
};

const bytesFormat = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'byte',
  unitDisplay: 'narrow',
});

/**
 * @param {string} name
 * @param {unknown} json
 */
async function logGzipSize(name, json) {
  const src = `${JSON.stringify(json)}\n`;
  const srcBytes = bytesFormat.format(Buffer.byteLength(src, 'utf8'));
  const gzipped = await gzipAsync(`${JSON.stringify(json)}\n`);
  const gzipBytes = bytesFormat.format(gzipped.length);
  console.log(`${name}: ${srcBytes} (${gzipBytes} gzip)`);
}

await logGzipSize('before', SRC_EMOJIS);
await logGzipSize('after', emojiData);

const json = PRETTY
  ? JSON.stringify(emojiData, null, 2)
  : JSON.stringify(emojiData);
await writeFile(EMOJI_DATA_PATH, `${json}\n`);
