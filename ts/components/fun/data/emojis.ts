// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import Fuse from 'fuse.js';
import { sortBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import * as log from '../../../logging/log';
import type { LocaleEmojiListType } from '../../../types/emoji';
import type { LocalizerType } from '../../../types/I18N';
import { strictAssert } from '../../../util/assert';
import { drop } from '../../../util/drop';
import { parseUnknown } from '../../../util/schemas';

// Import emoji-datasource dynamically to avoid costly typechecking.
// eslint-disable-next-line import/no-dynamic-require, @typescript-eslint/no-var-requires
const RAW_UNTYPED_DATA: unknown = require('emoji-datasource' as string);

/**
 * Types
 */

export enum EmojiUnicodeCategory {
  SmileysAndEmotion = 'EmojiUnicodeCategory.SmileysAndEmotion',
  PeopleAndBody = 'EmojiUnicodeCategory.PeopleAndBody',
  Component = 'EmojiUnicodeCategory.Component',
  AnimalsAndNature = 'EmojiUnicodeCategory.AnimalsAndNature',
  FoodAndDrink = 'EmojiUnicodeCategory.FoodAndDrink',
  TravelAndPlaces = 'EmojiUnicodeCategory.TravelAndPlaces',
  Activities = 'EmojiUnicodeCategory.Activities',
  Objects = 'EmojiUnicodeCategory.Objects',
  Symbols = 'EmojiUnicodeCategory.Symbols',
  Flags = 'EmojiUnicodeCategory.Flags',
}

export enum EmojiPickerCategory {
  SmileysAndPeople = 'EmojiPickerCategory.SmileysAndPeople',
  AnimalsAndNature = 'EmojiPickerCategory.AnimalsAndNature',
  FoodAndDrink = 'EmojiPickerCategory.FoodAndDrink',
  TravelAndPlaces = 'EmojiPickerCategory.TravelAndPlaces',
  Activities = 'EmojiPickerCategory.Activities',
  Objects = 'EmojiPickerCategory.Objects',
  Symbols = 'EmojiPickerCategory.Symbols',
  Flags = 'EmojiPickerCategory.Flags',
}

export enum EmojiSkinTone {
  None = 'EmojiSkinTone.None',
  Type1 = 'EmojiSkinTone.Type1', // 1F3FB
  Type2 = 'EmojiSkinTone.Type2', // 1F3FC
  Type3 = 'EmojiSkinTone.Type3', // 1F3FD
  Type4 = 'EmojiSkinTone.Type4', // 1F3FE
  Type5 = 'EmojiSkinTone.Type5', // 1F3FF
}

/** @deprecated We should use `EmojiSkinTone` everywhere */
export const SKIN_TONE_TO_NUMBER: Map<EmojiSkinTone, number> = new Map([
  [EmojiSkinTone.None, 0],
  [EmojiSkinTone.Type1, 1],
  [EmojiSkinTone.Type2, 2],
  [EmojiSkinTone.Type3, 3],
  [EmojiSkinTone.Type4, 4],
  [EmojiSkinTone.Type5, 5],
]);

/** @deprecated We should use `EmojiSkinTone` everywhere */
export const NUMBER_TO_SKIN_TONE: Map<number, EmojiSkinTone> = new Map([
  [0, EmojiSkinTone.None],
  [1, EmojiSkinTone.Type1],
  [2, EmojiSkinTone.Type2],
  [3, EmojiSkinTone.Type3],
  [4, EmojiSkinTone.Type4],
  [5, EmojiSkinTone.Type5],
]);

export type EmojiSkinToneVariant = Exclude<EmojiSkinTone, EmojiSkinTone.None>;

const KeyToEmojiSkinTone: Record<string, EmojiSkinToneVariant> = {
  '1F3FB': EmojiSkinTone.Type1,
  '1F3FC': EmojiSkinTone.Type2,
  '1F3FD': EmojiSkinTone.Type3,
  '1F3FE': EmojiSkinTone.Type4,
  '1F3FF': EmojiSkinTone.Type5,
};

export type EmojiParentKey = string & { EmojiParentKey: never };
export type EmojiVariantKey = string & { EmojiVariantKey: never };

export type EmojiParentValue = string & { EmojiParentValue: never };
export type EmojiVariantValue = string & { EmojiVariantValue: never };

/** @deprecated Prefer EmojiKey for refs, load short names from translations */
export type EmojiEnglishShortName = string & { EmojiEnglishShortName: never };

export type EmojiVariantData = Readonly<{
  key: EmojiVariantKey;
  value: EmojiVariantValue;
  sheetX: number;
  sheetY: number;
}>;

type EmojiDefaultSkinToneVariants = Record<
  EmojiSkinToneVariant,
  EmojiVariantKey
>;

export type EmojiParentData = Readonly<{
  key: EmojiParentKey;
  value: EmojiParentValue;
  unicodeCategory: EmojiUnicodeCategory;
  pickerCategory: EmojiPickerCategory | null;
  defaultVariant: EmojiVariantKey;
  defaultSkinToneVariants: EmojiDefaultSkinToneVariants | null;
  /** @deprecated Prefer EmojiKey for refs, load short names from translations */
  englishShortNameDefault: EmojiEnglishShortName;
  /** @deprecated Prefer EmojiKey for refs, load short names from translations */
  englishShortNames: ReadonlyArray<EmojiEnglishShortName>;
  emoticonDefault: string | null;
  emoticons: ReadonlyArray<string>;
}>;

/**
 * Schemas
 */

const RawEmojiSkinToneSchema = z.object({
  unified: z.string(),
  sheet_x: z.number(),
  sheet_y: z.number(),
  has_img_apple: z.boolean(),
});

const RawEmojiSkinToneMapSchema = z.record(z.string(), RawEmojiSkinToneSchema);

const RawEmojiSchema = z.object({
  unified: z.string(),
  category: z.string(),
  sort_order: z.number(),
  sheet_x: z.number(),
  sheet_y: z.number(),
  has_img_apple: z.boolean(),
  short_name: z.string(),
  short_names: z.array(z.string()),
  text: z.nullable(z.string()),
  texts: z.nullable(z.array(z.string())),
  skin_variations: RawEmojiSkinToneMapSchema.optional(),
});

const RAW_UNICODE_CATEGORY_MAP: Record<string, EmojiUnicodeCategory> = {
  'Smileys & Emotion': EmojiUnicodeCategory.SmileysAndEmotion,
  'People & Body': EmojiUnicodeCategory.PeopleAndBody,
  Component: EmojiUnicodeCategory.Component,
  'Animals & Nature': EmojiUnicodeCategory.AnimalsAndNature,
  'Food & Drink': EmojiUnicodeCategory.FoodAndDrink,
  'Travel & Places': EmojiUnicodeCategory.TravelAndPlaces,
  Activities: EmojiUnicodeCategory.Activities,
  Objects: EmojiUnicodeCategory.Objects,
  Symbols: EmojiUnicodeCategory.Symbols,
  Flags: EmojiUnicodeCategory.Flags,
};

const RAW_PICKER_CATEGORY_MAP: Record<string, EmojiPickerCategory | null> = {
  'Smileys & Emotion': EmojiPickerCategory.SmileysAndPeople, // merged
  'People & Body': EmojiPickerCategory.SmileysAndPeople, // merged
  Component: null, // dropped
  'Animals & Nature': EmojiPickerCategory.AnimalsAndNature,
  'Food & Drink': EmojiPickerCategory.FoodAndDrink,
  'Travel & Places': EmojiPickerCategory.TravelAndPlaces,
  Activities: EmojiPickerCategory.Activities,
  Objects: EmojiPickerCategory.Objects,
  Symbols: EmojiPickerCategory.Symbols,
  Flags: EmojiPickerCategory.Flags,
};

/**
 * Data Normalization
 */

function toEmojiUnicodeCategory(category: string): EmojiUnicodeCategory {
  const result = RAW_UNICODE_CATEGORY_MAP[category];
  strictAssert(result != null, `Unknown category: ${category}`);
  return result;
}

function toEmojiPickerCategory(category: string): EmojiPickerCategory | null {
  const result = RAW_PICKER_CATEGORY_MAP[category];
  strictAssert(
    typeof result !== 'undefined',
    `Unknown picker category: ${category}`
  );
  return result;
}

function toEmojiParentKey(unified: string): EmojiParentKey {
  return unified as EmojiParentKey;
}

function toEmojiVariantKey(unified: string): EmojiVariantKey {
  return unified as EmojiVariantKey;
}

function encodeUnified(unified: string): string {
  return unified
    .split('-')
    .map(char => String.fromCodePoint(Number.parseInt(char, 16)))
    .join('');
}

function toEmojiParentValue(unified: string): EmojiParentValue {
  return encodeUnified(unified) as EmojiParentValue;
}

function toEmojiVariantValue(unified: string): EmojiVariantValue {
  return encodeUnified(unified) as EmojiVariantValue;
}

const RAW_EMOJI_DATA = parseUnknown(
  z.array(RawEmojiSchema),
  RAW_UNTYPED_DATA
).sort((a, b) => {
  return a.sort_order - b.sort_order;
});

type EmojiSearchIndexEntry = Readonly<{
  key: EmojiParentKey;
  rank: number | null;
  shortName: string;
  shortNames: ReadonlyArray<string>;
  emoticon: string | null;
  emoticons: ReadonlyArray<string>;
}>;

type EmojiSearchIndex = ReadonlyArray<EmojiSearchIndexEntry>;

type EmojiIndex = Readonly<{
  // raw data
  parentByKey: Record<EmojiParentKey, EmojiParentData>;
  parentKeysByName: Record<EmojiEnglishShortName, EmojiParentKey>;
  parentKeysByValue: Record<EmojiParentValue, EmojiParentKey>;
  parentKeysByVariantKeys: Record<EmojiVariantKey, EmojiParentKey>;

  variantByKey: Record<EmojiVariantKey, EmojiVariantData>;
  variantKeysByValue: Record<EmojiVariantValue, EmojiVariantKey>;

  unicodeCategories: Record<EmojiUnicodeCategory, Array<EmojiParentKey>>;
  pickerCategories: Record<EmojiPickerCategory, Array<EmojiParentKey>>;

  defaultEnglishSearchIndex: Array<EmojiSearchIndexEntry>;
}>;

const EMOJI_INDEX: EmojiIndex = {
  parentByKey: {},
  parentKeysByValue: {},
  parentKeysByName: {},
  parentKeysByVariantKeys: {},
  variantByKey: {},
  variantKeysByValue: {},
  unicodeCategories: {
    [EmojiUnicodeCategory.SmileysAndEmotion]: [],
    [EmojiUnicodeCategory.PeopleAndBody]: [],
    [EmojiUnicodeCategory.Component]: [],
    [EmojiUnicodeCategory.AnimalsAndNature]: [],
    [EmojiUnicodeCategory.FoodAndDrink]: [],
    [EmojiUnicodeCategory.TravelAndPlaces]: [],
    [EmojiUnicodeCategory.Activities]: [],
    [EmojiUnicodeCategory.Objects]: [],
    [EmojiUnicodeCategory.Symbols]: [],
    [EmojiUnicodeCategory.Flags]: [],
  },
  pickerCategories: {
    [EmojiPickerCategory.SmileysAndPeople]: [],
    [EmojiPickerCategory.AnimalsAndNature]: [],
    [EmojiPickerCategory.FoodAndDrink]: [],
    [EmojiPickerCategory.TravelAndPlaces]: [],
    [EmojiPickerCategory.Activities]: [],
    [EmojiPickerCategory.Objects]: [],
    [EmojiPickerCategory.Symbols]: [],
    [EmojiPickerCategory.Flags]: [],
  },
  defaultEnglishSearchIndex: [],
};

function addParent(parent: EmojiParentData, rank: number) {
  EMOJI_INDEX.parentByKey[parent.key] = parent;
  EMOJI_INDEX.parentKeysByValue[parent.value] = parent.key;
  EMOJI_INDEX.parentKeysByName[parent.englishShortNameDefault] = parent.key;
  EMOJI_INDEX.unicodeCategories[parent.unicodeCategory].push(parent.key);
  if (parent.pickerCategory != null) {
    EMOJI_INDEX.pickerCategories[parent.pickerCategory].push(parent.key);
  }

  for (const englishShortName of parent.englishShortNames) {
    EMOJI_INDEX.parentKeysByName[englishShortName] = parent.key;
  }

  EMOJI_INDEX.defaultEnglishSearchIndex.push({
    key: parent.key,
    rank,
    shortName: parent.englishShortNameDefault,
    shortNames: parent.englishShortNames,
    emoticon: parent.emoticonDefault,
    emoticons: parent.emoticons,
  });
}

function addVariant(parentKey: EmojiParentKey, variant: EmojiVariantData) {
  EMOJI_INDEX.parentKeysByVariantKeys[variant.key] = parentKey;
  EMOJI_INDEX.variantByKey[variant.key] = variant;
  EMOJI_INDEX.variantKeysByValue[variant.value] = variant.key;
}

for (const rawEmoji of RAW_EMOJI_DATA) {
  const parentKey = toEmojiParentKey(rawEmoji.unified);

  const defaultVariant: EmojiVariantData = {
    key: toEmojiVariantKey(rawEmoji.unified),
    value: toEmojiVariantValue(rawEmoji.unified),
    sheetX: rawEmoji.sheet_x,
    sheetY: rawEmoji.sheet_y,
  };

  addVariant(parentKey, defaultVariant);

  let defaultSkinToneVariants: EmojiDefaultSkinToneVariants | null = null;
  if (rawEmoji.skin_variations != null) {
    const map = new Map<string, EmojiVariantKey>();

    for (const [key, value] of Object.entries(rawEmoji.skin_variations)) {
      const variantKey = toEmojiVariantKey(value.unified);
      map.set(key, variantKey);

      const skinToneVariant: EmojiVariantData = {
        key: variantKey,
        value: toEmojiVariantValue(value.unified),
        sheetX: value.sheet_x,
        sheetY: value.sheet_y,
      };

      addVariant(parentKey, skinToneVariant);
    }

    const result: Partial<EmojiDefaultSkinToneVariants> = {};
    for (const [key, skinTone] of Object.entries(KeyToEmojiSkinTone)) {
      const one = map.get(key) ?? null;
      const two = map.get(`${key}-${key}`) ?? null;
      const variantKey = one ?? two;
      if (variantKey == null) {
        const keys = Object.keys(rawEmoji.skin_variations);
        throw new Error(`Missing variant key ${parentKey} -> ${key} (${keys})`);
      }
      result[skinTone] = variantKey;
    }

    defaultSkinToneVariants = result as EmojiDefaultSkinToneVariants;
  }

  const parent: EmojiParentData = {
    key: toEmojiParentKey(rawEmoji.unified),
    value: toEmojiParentValue(rawEmoji.unified),
    unicodeCategory: toEmojiUnicodeCategory(rawEmoji.category),
    pickerCategory: toEmojiPickerCategory(rawEmoji.category),
    defaultVariant: defaultVariant.key,
    defaultSkinToneVariants,
    englishShortNameDefault: rawEmoji.short_name as EmojiEnglishShortName,
    englishShortNames: rawEmoji.short_names as Array<EmojiEnglishShortName>,
    emoticonDefault: rawEmoji.text ?? null,
    emoticons: rawEmoji.texts ?? [],
  };

  addParent(parent, rawEmoji.sort_order);
}

export function isEmojiParentKey(input: string): input is EmojiParentKey {
  return Object.hasOwn(EMOJI_INDEX.parentByKey, input);
}

export function isEmojiVariantKey(input: string): input is EmojiVariantKey {
  return Object.hasOwn(EMOJI_INDEX.variantByKey, input);
}

export function isEmojiParentValue(input: string): input is EmojiParentValue {
  return Object.hasOwn(EMOJI_INDEX.parentKeysByValue, input);
}

export function isEmojiVariantValue(input: string): input is EmojiVariantValue {
  return Object.hasOwn(EMOJI_INDEX.variantKeysByValue, input);
}

/** @deprecated Prefer EmojiKey for refs, load short names from translations */
export function isEmojiEnglishShortName(
  input: string
): input is EmojiEnglishShortName {
  return Object.hasOwn(EMOJI_INDEX.parentKeysByName, input);
}

export function getEmojiParentByKey(key: EmojiParentKey): EmojiParentData {
  const data = EMOJI_INDEX.parentByKey[key];
  strictAssert(data, `Missing emoji parent data for key "${key}"`);
  return data;
}

export function getEmojiVariantByKey(key: EmojiVariantKey): EmojiVariantData {
  const data = EMOJI_INDEX.variantByKey[key];
  strictAssert(data, `Missing emoji variant data for key "${key}"`);
  return data;
}

export function getEmojiParentKeyByValueUnsafe(input: string): EmojiParentKey {
  strictAssert(
    isEmojiParentValue(input),
    `Missing emoji parent value for input "${input}"`
  );
  const key = EMOJI_INDEX.parentKeysByValue[input];
  strictAssert(key, `Missing emoji parent key for input "${input}"`);
  return key;
}

export function getEmojiParentKeyByValue(
  value: EmojiParentValue
): EmojiParentKey {
  const key = EMOJI_INDEX.parentKeysByValue[value];
  strictAssert(key, `Missing emoji parent key for value "${value}"`);
  return key;
}

export function getEmojiVariantKeyByValue(
  value: EmojiVariantValue
): EmojiVariantKey {
  const key = EMOJI_INDEX.variantKeysByValue[value];
  strictAssert(key, `Missing emoji variant key for value "${value}"`);
  return key;
}

export function getEmojiParentKeyByVariantKey(
  key: EmojiVariantKey
): EmojiParentKey {
  const parentKey = EMOJI_INDEX.parentKeysByVariantKeys[key];
  strictAssert(parentKey, `Missing parent key for variant key "${key}"`);
  return parentKey;
}

export function getEmojiUnicodeCategoryParentKeys(
  category: EmojiUnicodeCategory
): ReadonlyArray<EmojiParentKey> {
  const parents = EMOJI_INDEX.unicodeCategories[category];
  strictAssert(parents, `Missing category emojis for ${category}`);
  return parents;
}

export function getEmojiPickerCategoryParentKeys(
  category: EmojiPickerCategory
): ReadonlyArray<EmojiParentKey> {
  const parents = EMOJI_INDEX.pickerCategories[category];
  strictAssert(parents, `Missing category emojis for ${category}`);
  return parents;
}

/**
 * Apply a skin tone (if possible) to any parent key.
 */
export function getEmojiVariantByParentKeyAndSkinTone(
  key: EmojiParentKey,
  skinTone: EmojiSkinTone | null
): EmojiVariantData {
  const parent = getEmojiParentByKey(key);
  const skinToneVariants = parent.defaultSkinToneVariants;

  if (
    skinTone == null ||
    skinTone === EmojiSkinTone.None ||
    skinToneVariants == null
  ) {
    return getEmojiVariantByKey(parent.defaultVariant);
  }

  const variantKey = skinToneVariants[skinTone];
  strictAssert(variantKey, `Missing skin tone variant for ${skinTone}`);

  return getEmojiVariantByKey(variantKey);
}

/** @deprecated */
export function getEmojiParentKeyByEnglishShortName(
  englishShortName: EmojiEnglishShortName
): EmojiParentKey {
  const emojiKey = EMOJI_INDEX.parentKeysByName[englishShortName];
  strictAssert(emojiKey, `Missing emoji info for ${englishShortName}`);
  return emojiKey;
}

/** Exported for testing */
export function* _allEmojiVariantKeys(): Iterable<EmojiVariantKey> {
  yield* Object.keys(EMOJI_INDEX.variantByKey) as Array<EmojiVariantKey>;
}

export function emojiVariantConstant(input: string): EmojiVariantData {
  strictAssert(
    isEmojiVariantValue(input),
    `Missing emoji variant for value "${input}"`
  );
  const key = getEmojiVariantKeyByValue(input);
  return getEmojiVariantByKey(key);
}

/**
 * Search
 */

export type EmojiSearch = (
  query: string,
  limit?: number
) => Array<EmojiParentKey>;

function createEmojiSearchIndex(
  localeEmojiList: LocaleEmojiListType
): EmojiSearchIndex {
  const results: Array<EmojiSearchIndexEntry> = [];

  for (const localeEmoji of localeEmojiList) {
    if (!isEmojiParentValue(localeEmoji.emoji)) {
      // Skipping unknown emoji, most likely apple doesn't support it
      continue;
    }

    const parentKey = getEmojiParentKeyByValue(localeEmoji.emoji);
    const emoji = getEmojiParentByKey(parentKey);
    results.push({
      key: parentKey,
      rank: localeEmoji.rank,
      shortName: localeEmoji.shortName,
      shortNames: localeEmoji.tags,
      emoticon: emoji.emoticonDefault,
      emoticons: emoji.emoticons,
    });
  }

  return results;
}

const FuseKeys: Array<Fuse.FuseOptionKey> = [
  { name: 'shortName', weight: 100 },
  // { name: 'shortNames', weight: 1 },
  { name: 'emoticon', weight: 50 },
  { name: 'emoticons', weight: 1 },
];

const FuseFuzzyOptions: Fuse.IFuseOptions<EmojiSearchIndexEntry> = {
  shouldSort: false,
  threshold: 0.2,
  minMatchCharLength: 1,
  keys: FuseKeys,
  includeScore: true,
};

const FuseExactOptions: Fuse.IFuseOptions<EmojiSearchIndexEntry> = {
  shouldSort: false,
  threshold: 0,
  minMatchCharLength: 1,
  keys: FuseKeys,
  includeScore: true,
};

function createEmojiSearch(emojiSearchIndex: EmojiSearchIndex): EmojiSearch {
  const fuseIndex = Fuse.createIndex(FuseKeys, emojiSearchIndex);
  const fuseFuzzy = new Fuse(emojiSearchIndex, FuseFuzzyOptions, fuseIndex);
  const fuseExact = new Fuse(emojiSearchIndex, FuseExactOptions, fuseIndex);

  return function emojiSearch(query, limit = 200) {
    // Prefer exact matches at 2 characters
    const fuse = query.length < 2 ? fuseExact : fuseFuzzy;

    const rawResults = fuse.search(query.substring(0, 32), {
      limit: limit * 2,
    });

    const rankedResults = rawResults.map(result => {
      const rank = result.item.rank ?? 1e9;

      // Exact prefix matches in [0,1] range
      if (result.item.shortName.startsWith(query)) {
        return {
          score: result.item.shortName.length / query.length,
          item: result.item,
        };
      }

      // Other matches in [1,], ordered by score and rank
      return {
        score: 1 + (result.score ?? 0) + rank / emojiSearchIndex.length,
        item: result.item,
      };
    });

    const sortedResults = sortBy(rankedResults, result => {
      return result.score;
    });

    const truncatedResults = sortedResults.slice(0, limit);

    return truncatedResults.map(result => {
      return result.item.key;
    });
  };
}

export function useEmojiSearch(i18n: LocalizerType): EmojiSearch {
  const locale = i18n.getLocale();
  const [localeIndex, setLocaleIndex] = useState<EmojiSearchIndex | null>(null);

  useEffect(() => {
    let canceled = false;

    async function run() {
      try {
        const list = await window.SignalContext.getLocalizedEmojiList(locale);
        if (!canceled) {
          const result = createEmojiSearchIndex(list);
          setLocaleIndex(result);
        }
      } catch (error) {
        log.error(`Failed to get localized emoji list for ${locale}`, error);
      }
    }

    drop(run());

    return () => {
      canceled = true;
    };
  }, [locale]);

  const searchIndex = useMemo(() => {
    return localeIndex ?? EMOJI_INDEX.defaultEnglishSearchIndex;
  }, [localeIndex]);

  const emojiSearch = useMemo(() => {
    return createEmojiSearch(searchIndex);
  }, [searchIndex]);

  return emojiSearch;
}
