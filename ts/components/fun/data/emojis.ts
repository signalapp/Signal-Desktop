// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import emojiRegex from 'emoji-regex';
import { strictAssert } from '../../../util/assert';
import { parseUnknown } from '../../../util/schemas';
import type {
  FunEmojiSearchIndex,
  FunEmojiSearchIndexEntry,
} from '../useFunEmojiSearch';
import type { FunEmojiLocalizerIndex } from '../useFunEmojiLocalizer';

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

export function isValidEmojiSkinTone(value: unknown): value is EmojiSkinTone {
  return (
    typeof value === 'string' &&
    EMOJI_SKIN_TONE_ORDER.includes(value as EmojiSkinTone)
  );
}

export const EMOJI_SKIN_TONE_ORDER: ReadonlyArray<EmojiSkinTone> = [
  EmojiSkinTone.None,
  EmojiSkinTone.Type1,
  EmojiSkinTone.Type2,
  EmojiSkinTone.Type3,
  EmojiSkinTone.Type4,
  EmojiSkinTone.Type5,
];

/** @deprecated We should use `EmojiSkinTone` everywhere */
export const EMOJI_SKIN_TONE_TO_NUMBER: Map<EmojiSkinTone, number> = new Map([
  [EmojiSkinTone.None, 0],
  [EmojiSkinTone.Type1, 1],
  [EmojiSkinTone.Type2, 2],
  [EmojiSkinTone.Type3, 3],
  [EmojiSkinTone.Type4, 4],
  [EmojiSkinTone.Type5, 5],
]);

/** @deprecated We should use `EmojiSkinTone` everywhere */
export const KEY_TO_EMOJI_SKIN_TONE = new Map<string, EmojiSkinTone>([
  ['1F3FB', EmojiSkinTone.Type1],
  ['1F3FC', EmojiSkinTone.Type2],
  ['1F3FD', EmojiSkinTone.Type3],
  ['1F3FE', EmojiSkinTone.Type4],
  ['1F3FF', EmojiSkinTone.Type5],
]);

/** @deprecated We should use `EmojiSkinTone` everywhere */
export const EMOJI_SKIN_TONE_TO_KEY: Map<EmojiSkinTone, string> = new Map([
  [EmojiSkinTone.Type1, '1F3FB'],
  [EmojiSkinTone.Type2, '1F3FC'],
  [EmojiSkinTone.Type3, '1F3FD'],
  [EmojiSkinTone.Type4, '1F3FE'],
  [EmojiSkinTone.Type5, '1F3FF'],
]);

export type EmojiParentKey = string & { EmojiParentKey: never };
export type EmojiVariantKey = string & { EmojiVariantKey: never };

export type EmojiParentValue = string & { EmojiParentValue: never };
export type EmojiVariantValue = string & { EmojiVariantValue: never };

/** @deprecated Prefer EmojiKey for refs, load short names from translations */
export type EmojiEnglishShortName = string & { EmojiEnglishShortName: never };

export type EmojiVariantData = Readonly<{
  key: EmojiVariantKey;
  value: EmojiVariantValue;
  valueNonqualified: EmojiVariantValue | null;
  sheetX: number;
  sheetY: number;
}>;

type EmojiDefaultSkinToneVariants = Record<EmojiSkinTone, EmojiVariantKey>;

export type EmojiParentData = Readonly<{
  key: EmojiParentKey;
  value: EmojiParentValue;
  valueNonqualified: EmojiParentValue | null;
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
  non_qualified: z.union([z.string(), z.null()]),
  sheet_x: z.number(),
  sheet_y: z.number(),
  has_img_apple: z.boolean(),
});

const RawEmojiSkinToneMapSchema = z.record(z.string(), RawEmojiSkinToneSchema);

const RawEmojiSchema = z.object({
  unified: z.string(),
  non_qualified: z.union([z.string(), z.null()]),
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

/** @internal */
type EmojiIndex = Readonly<{
  // raw data
  parentByKey: Map<EmojiParentKey, EmojiParentData>;
  parentKeysByName: Map<EmojiEnglishShortName, EmojiParentKey>;
  parentKeysByValue: Map<EmojiParentValue, EmojiParentKey>;
  parentKeysByValueNonQualified: Map<EmojiParentValue, EmojiParentKey>;
  parentKeysByVariantKeys: Map<EmojiVariantKey, EmojiParentKey>;

  variantByKey: Map<EmojiVariantKey, EmojiVariantData>;
  variantKeysByValue: Map<EmojiVariantValue, EmojiVariantKey>;
  variantKeysByValueNonQualified: Map<EmojiVariantValue, EmojiVariantKey>;

  unicodeCategories: Record<EmojiUnicodeCategory, Array<EmojiParentKey>>;
  pickerCategories: Record<EmojiPickerCategory, Array<EmojiParentKey>>;

  defaultEnglishSearchIndex: Array<FunEmojiSearchIndexEntry>;
  defaultEnglishLocalizerIndex: Map<EmojiParentKey, string>;
}>;

/** @internal */
const EMOJI_INDEX: EmojiIndex = {
  parentByKey: new Map(),
  parentKeysByValue: new Map(),
  parentKeysByValueNonQualified: new Map(),
  parentKeysByName: new Map(),
  parentKeysByVariantKeys: new Map(),
  variantByKey: new Map(),
  variantKeysByValue: new Map(),
  variantKeysByValueNonQualified: new Map(),
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
  defaultEnglishLocalizerIndex: new Map(),
};

function addParent(parent: EmojiParentData, rank: number) {
  EMOJI_INDEX.parentByKey.set(parent.key, parent);
  EMOJI_INDEX.parentKeysByValue.set(parent.value, parent.key);
  if (parent.valueNonqualified != null) {
    EMOJI_INDEX.parentKeysByValue.set(parent.valueNonqualified, parent.key);
    EMOJI_INDEX.parentKeysByValueNonQualified.set(
      parent.valueNonqualified,
      parent.key
    );
  }
  EMOJI_INDEX.parentKeysByName.set(parent.englishShortNameDefault, parent.key);
  EMOJI_INDEX.unicodeCategories[parent.unicodeCategory].push(parent.key);
  if (parent.pickerCategory != null) {
    EMOJI_INDEX.pickerCategories[parent.pickerCategory].push(parent.key);
  }

  for (const englishShortName of parent.englishShortNames) {
    EMOJI_INDEX.parentKeysByName.set(englishShortName, parent.key);
  }

  EMOJI_INDEX.defaultEnglishSearchIndex.push({
    key: parent.key,
    rank,
    shortName: parent.englishShortNameDefault,
    shortNames: parent.englishShortNames,
    emoticon: parent.emoticonDefault,
    emoticons: parent.emoticons,
  });

  EMOJI_INDEX.defaultEnglishLocalizerIndex.set(
    parent.key,
    parent.englishShortNameDefault
  );
}

function addVariant(parentKey: EmojiParentKey, variant: EmojiVariantData) {
  EMOJI_INDEX.parentKeysByVariantKeys.set(variant.key, parentKey);
  EMOJI_INDEX.variantByKey.set(variant.key, variant);
  EMOJI_INDEX.variantKeysByValue.set(variant.value, variant.key);
  if (variant.valueNonqualified) {
    EMOJI_INDEX.variantKeysByValue.set(variant.valueNonqualified, variant.key);
    EMOJI_INDEX.variantKeysByValueNonQualified.set(
      variant.valueNonqualified,
      variant.key
    );
  }
}

for (const rawEmoji of RAW_EMOJI_DATA) {
  const parentKey = toEmojiParentKey(rawEmoji.unified);

  const defaultVariant: EmojiVariantData = {
    key: toEmojiVariantKey(rawEmoji.unified),
    value: toEmojiVariantValue(rawEmoji.unified),
    valueNonqualified:
      rawEmoji.non_qualified != null
        ? toEmojiVariantValue(rawEmoji.non_qualified)
        : null,
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
        valueNonqualified:
          rawEmoji.non_qualified != null
            ? toEmojiVariantValue(rawEmoji.non_qualified)
            : null,
        sheetX: value.sheet_x,
        sheetY: value.sheet_y,
      };

      addVariant(parentKey, skinToneVariant);
    }

    const result: Partial<EmojiDefaultSkinToneVariants> = {};
    for (const [key, skinTone] of KEY_TO_EMOJI_SKIN_TONE) {
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
    valueNonqualified:
      rawEmoji.non_qualified != null
        ? toEmojiParentValue(rawEmoji.non_qualified)
        : null,
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
  return EMOJI_INDEX.parentByKey.has(input as EmojiParentKey);
}

export function isEmojiVariantKey(input: string): input is EmojiVariantKey {
  return EMOJI_INDEX.variantByKey.has(input as EmojiVariantKey);
}

export function isEmojiParentValue(input: string): input is EmojiParentValue {
  return EMOJI_INDEX.parentKeysByValue.has(input as EmojiParentValue);
}

export function isEmojiVariantValue(input: string): input is EmojiVariantValue {
  return EMOJI_INDEX.variantKeysByValue.has(input as EmojiVariantValue);
}

export function isEmojiVariantValueNonQualified(
  input: EmojiVariantValue
): boolean {
  return EMOJI_INDEX.variantKeysByValueNonQualified.has(input);
}

/** @deprecated Prefer EmojiKey for refs, load short names from translations */
export function isEmojiEnglishShortName(
  input: string
): input is EmojiEnglishShortName {
  return EMOJI_INDEX.parentKeysByName.has(input as EmojiEnglishShortName);
}

export function getEmojiParentByKey(key: EmojiParentKey): EmojiParentData {
  const data = EMOJI_INDEX.parentByKey.get(key);
  strictAssert(data, `Missing emoji parent data for key "${key}"`);
  return data;
}

export function getEmojiVariantByKey(key: EmojiVariantKey): EmojiVariantData {
  const data = EMOJI_INDEX.variantByKey.get(key);
  strictAssert(data, `Missing emoji variant data for key "${key}"`);
  return data;
}

export function getEmojiParentKeyByValue(
  value: EmojiParentValue
): EmojiParentKey {
  const key = EMOJI_INDEX.parentKeysByValue.get(value);
  strictAssert(key, `Missing emoji parent key for value "${value}"`);
  return key;
}

export function getEmojiVariantKeyByValue(
  value: EmojiVariantValue
): EmojiVariantKey {
  const key = EMOJI_INDEX.variantKeysByValue.get(value);
  strictAssert(key, `Missing emoji variant key for value "${value}"`);
  return key;
}

export function getEmojiParentKeyByVariantKey(
  key: EmojiVariantKey
): EmojiParentKey {
  const parentKey = EMOJI_INDEX.parentKeysByVariantKeys.get(key);
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
  skinTone: EmojiSkinTone
): EmojiVariantData {
  const parent = getEmojiParentByKey(key);
  const skinToneVariants = parent.defaultSkinToneVariants;

  if (skinTone === EmojiSkinTone.None || skinToneVariants == null) {
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
  const emojiKey = EMOJI_INDEX.parentKeysByName.get(englishShortName);
  strictAssert(emojiKey, `Missing emoji info for ${englishShortName}`);
  return emojiKey;
}

export function getEmojiDefaultEnglishSearchIndex(): FunEmojiSearchIndex {
  return EMOJI_INDEX.defaultEnglishSearchIndex;
}

export function getEmojiDefaultEnglishLocalizerIndex(): FunEmojiLocalizerIndex {
  return EMOJI_INDEX.defaultEnglishLocalizerIndex;
}

/** Exported for testing */
export function* _allEmojiVariantKeys(): Iterable<EmojiVariantKey> {
  yield* Object.keys(EMOJI_INDEX.variantByKey) as Array<EmojiVariantKey>;
}

export function emojiParentKeyConstant(input: string): EmojiParentKey {
  strictAssert(
    isEmojiParentValue(input),
    `Missing emoji parent for value "${input}"`
  );
  return getEmojiParentKeyByValue(input);
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
 * Emojify
 */

function isSafeEmojifyEmoji(value: string): value is EmojiVariantValue {
  return isEmojiVariantValue(value) && !isEmojiVariantValueNonQualified(value);
}

export type EmojiSpan = Readonly<{
  index: number;
  length: number;
  emoji: EmojiVariantValue;
}>;

export type EmojifyData = Readonly<{
  text: string;
  emojiCount: number;
  isEmojiOnlyText: boolean;
}>;

export function getEmojifyData(input: string): EmojifyData {
  // Fast path, and treat empty strings like they have non-emoji text
  if (input === '' || input.trim() === '') {
    return { text: input, emojiCount: 0, isEmojiOnlyText: false };
  }

  let hasEmojis = false;
  let hasNonEmojis = false;
  let emojiCount = 0;

  const regex = emojiRegex();

  let match = regex.exec(input);
  let lastIndex = 0;
  while (match) {
    const value = match[0];

    // Only consider safe emojis as matches
    if (isSafeEmojifyEmoji(value)) {
      const { index } = match;
      hasEmojis = true;
      // Track if we skipped over any text
      if (index > lastIndex) {
        hasNonEmojis = true;
        lastIndex += index;
      }
      emojiCount += 1;
      // Needs to be the value.length not the match.length
      lastIndex = index + value.length;
    }

    match = regex.exec(input);
  }

  // Track if we had any remaining text
  if (lastIndex === 0 || lastIndex < input.length) {
    hasNonEmojis = true;
  }

  return {
    text: input,
    emojiCount,
    isEmojiOnlyText: hasEmojis && !hasNonEmojis,
  };
}
