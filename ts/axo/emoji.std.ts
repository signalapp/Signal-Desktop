// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import getEmojiRegex from 'emoji-regex-xs';
import Fuse from 'fuse.js';
import type { FuseOptionKey, IFuseOptions } from 'fuse.js';
import LOOSE_EMOJI_DATA from '../../build/emoji-data.json' with { type: 'json' };
import { assert } from './_internal/assert.std.tsx';

function lazy<T>(fn: () => T): () => T {
  let cached: T;
  return () => {
    cached ??= fn();
    return cached;
  };
}

/**
 * Data
 * ----------------------------------------------------------------------------
 */

type ParentInfo = Readonly<{
  shortName: Emoji.ShortName;
  shortNameAlts?: ReadonlyArray<Emoji.ShortName>;
  emoticon?: string;
  emoticonAlts?: ReadonlyArray<string>;
  skinTones?: Readonly<Record<Emoji.SkinTone, Emoji.SkinToneVariant>>;
}>;

type EmojiData = Readonly<{
  categories: Record<Emoji.Category, Array<Emoji.Parent>>;
  emojis: Readonly<Record<Emoji.Parent, ParentInfo>>;
  parents: Readonly<Record<Emoji.SkinToneVariant, Emoji.Parent>>;
}>;

const EMOJI_DATA: EmojiData = {
  // TypeScript only complains about this one for some reason
  categories: LOOSE_EMOJI_DATA.categories as EmojiData['categories'],
  emojis: LOOSE_EMOJI_DATA.emojis,
  parents: LOOSE_EMOJI_DATA.parents,
};

function getParentInfo(parent: Emoji.Parent): ParentInfo {
  return assert(EMOJI_DATA.emojis[parent], `Missing "${parent}"`);
}

/** @internal */
function PARENT_AND_ONLY_VARIANT<const T extends string>(
  input: T
): T & Emoji.Parent & Emoji.Variant {
  assert(Emoji.isEmoji(input));
  assert(Emoji.isParent(input));
  const info = getParentInfo(input);
  assert(info.skinTones == null);
  return input as T & Emoji.Parent & Emoji.Variant;
}

/** @internal */
function PARENT(input: string): Emoji.Parent {
  assert(Emoji.isEmoji(input));
  assert(Emoji.isParent(input));
  const info = getParentInfo(input);
  assert(info.skinTones != null);
  return input;
}

/**
 * String Normalization
 * ----------------------------------------------------------------------------
 */

const EMOJI_COMPLETION_REGEX = /(?<!^)[\s,_-]+/gi;

/** @testexport For displaying in the ui */
export function _toEmojiCompletionLabel(
  shortName: Emoji.ShortName
): Emoji.CompletionLabel {
  return shortName
    .normalize()
    .replaceAll(EMOJI_COMPLETION_REGEX, '_')
    .toLowerCase() as Emoji.CompletionLabel;
}

/** @testexport For matching in search utils */
export function _toEmojiCompletionQuery(
  shortName: Emoji.ShortName
): Emoji.CompletionQuery {
  return shortName
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .replaceAll(EMOJI_COMPLETION_REGEX, ' ')
    .toLowerCase() as Emoji.CompletionQuery;
}

/**
 * Search
 * ----------------------------------------------------------------------------
 */

type SearchIndexEntry = Readonly<{
  parent: Emoji.Parent;
  rank: number;
  completion: Emoji.CompletionQuery;
  completionAlts: ReadonlyArray<Emoji.CompletionQuery>;
  emoticon: string | null;
  emoticonAlts: ReadonlyArray<string>;
}>;

const ALL_PARENTS_WITH_DEFAULT_RANK = lazy(() => {
  const parents = new Map<Emoji.Parent, number>();
  for (const category of Object.values(EMOJI_DATA.categories)) {
    for (const parent of category) {
      parents.set(parent, parents.size + 1);
    }
  }
  return parents;
});

type EmojiSearchFuseKey = FuseOptionKey<SearchIndexEntry> & {
  name: keyof SearchIndexEntry;
};

const EmojiSearchFuseKeys: Array<EmojiSearchFuseKey> = [
  { name: 'completion', weight: 100 },
  { name: 'completionAlts', weight: 1 },
  { name: 'emoticon', weight: 50 },
  { name: 'emoticonAlts', weight: 1 },
];

const EmojiSearchFuseFuzzyOptions: IFuseOptions<SearchIndexEntry> = {
  shouldSort: false,
  threshold: 0.2,
  minMatchCharLength: 1,
  keys: EmojiSearchFuseKeys,
  includeScore: true,
  includeMatches: true,
};

const EmojiSearchFuseExactOptions: IFuseOptions<SearchIndexEntry> = {
  shouldSort: false,
  threshold: 0,
  minMatchCharLength: 1,
  keys: EmojiSearchFuseKeys,
  includeScore: true,
  includeMatches: true,
};

/** @internal */
type EmojiSearchFuses = Readonly<{
  size: number;
  getExact: () => Fuse<SearchIndexEntry>;
  getFuzzy: () => Fuse<SearchIndexEntry>;
}>;

/** @internal */
function createEmojiSearchFuses(
  searchIndex: ReadonlyArray<SearchIndexEntry>
): EmojiSearchFuses {
  const size = searchIndex.length;
  const INDEX = lazy(() => Fuse.createIndex(EmojiSearchFuseKeys, searchIndex));
  return {
    size,
    getExact: lazy(
      () => new Fuse(searchIndex, EmojiSearchFuseExactOptions, INDEX())
    ),
    getFuzzy: lazy(
      () => new Fuse(searchIndex, EmojiSearchFuseFuzzyOptions, INDEX())
    ),
  };
}

/**
 * Localizer
 * ----------------------------------------------------------------------------
 */

/** @internal */
type EmojiLocalizer = Readonly<{
  getShortName: (parent: Emoji.Parent) => Emoji.ShortName;
  matchCompletion: (completion: Emoji.CompletionQuery) => Emoji.Parent | null;
  getSearchFuses: () => EmojiSearchFuses;
}>;

/** @internal */
const DEFAULT_ENGLISH_INDEXES = lazy(() => {
  const completionToParent = new Map<Emoji.CompletionQuery, Emoji.Parent>();
  const searchIndex: Array<SearchIndexEntry> = [];

  for (const [parent, rank] of ALL_PARENTS_WITH_DEFAULT_RANK()) {
    const info = getParentInfo(parent);
    const shortName = info.shortName;
    const shortNameAlts = info.shortNameAlts ?? [];

    const completion = _toEmojiCompletionQuery(shortName);
    const completionAlts = shortNameAlts.map(shortNameAlt => {
      return _toEmojiCompletionQuery(shortNameAlt);
    });

    completionToParent.set(completion, parent);

    searchIndex.push({
      parent,
      rank,
      completion,
      completionAlts,
      emoticon: info.emoticon ?? null,
      emoticonAlts: info.emoticonAlts ?? [],
    });
  }

  return { completionToParent, searchIndex };
});

/** @internal */
const DEFAULT_ENGLISH_LOCALIZER: EmojiLocalizer = {
  getShortName(value) {
    return getParentInfo(value).shortName;
  },
  matchCompletion(completion) {
    return DEFAULT_ENGLISH_INDEXES().completionToParent.get(completion) ?? null;
  },
  getSearchFuses() {
    return createEmojiSearchFuses(DEFAULT_ENGLISH_INDEXES().searchIndex);
  },
};

/** @internal */
let CURRENT_EMOJI_LOCALIZER: EmojiLocalizer | null = null;

/** @internal */
function getLocalizer() {
  return CURRENT_EMOJI_LOCALIZER ?? DEFAULT_ENGLISH_LOCALIZER;
}

/** @testexport */
export function _hasEmojiLocalizer(): boolean {
  return CURRENT_EMOJI_LOCALIZER != null;
}

/** @testexport */
export function _resetEmojiLocalizer(): void {
  CURRENT_EMOJI_LOCALIZER = null;
}

/**
 * API
 * ----------------------------------------------------------------------------
 */

export type Emoji = string & { Emoji: never };

export namespace Emoji {
  export type Parent = Emoji & { EmojiParent: never };
  export type Variant = Emoji & { EmojiVariant: never };
  export type SkinToneVariant = Variant & { EmojiSkinToneVariant: never };

  export type ShortName = string & { EmojiShortName: never };
  export type CompletionLabel = string & { EmojiCompletionLabel: never };
  export type CompletionQuery = string & { EmojiCompletionQuery: never };

  export enum SkinTone {
    None = '',
    Type1 = '1F3FB',
    Type2 = '1F3FC',
    Type3 = '1F3FD',
    Type4 = '1F3FE',
    Type5 = '1F3FF',
  }

  export enum Category {
    SMILIES_AND_PEOPLE = 'SMILIES_AND_PEOPLE',
    ANIMALS_AND_NATURE = 'ANIMALS_AND_NATURE',
    FOOD_AND_DRINK = 'FOOD_AND_DRINK',
    TRAVEL_AND_PLACES = 'TRAVEL_AND_PLACES',
    ACTIVITIES = 'ACTIVITIES',
    OBJECTS = 'OBJECTS',
    SYMBOLS = 'SYMBOLS',
    FLAGS = 'FLAGS',
  }

  export function getDebugLabel(input: string): string {
    return Array.from(input.slice(0, 12), char => {
      const num = char.codePointAt(0) ?? 0;
      const hex = num.toString(16).toUpperCase().padStart(4, '0');
      return `U+${hex}`;
    }).join(' ');
  }

  export function getDisplayLabel(emoji: Emoji): ShortName {
    return getLocalizer().getShortName(getParent(emoji));
  }

  export function getCompletionLabel(emoji: Emoji): CompletionLabel {
    return _toEmojiCompletionLabel(getDisplayLabel(emoji));
  }

  export function isEmoji(input: string): input is Emoji {
    return isParent(input) || isSkinToneVariant(input);
  }

  export function isParent(emoji: string): emoji is Parent {
    return Object.hasOwn(EMOJI_DATA.emojis, emoji);
  }

  export function isSkinToneVariant(emoji: string): emoji is SkinToneVariant {
    return Object.hasOwn(EMOJI_DATA.parents, emoji);
  }

  export function matchShortName(shortName: string): Parent | null {
    const query = _toEmojiCompletionQuery(shortName as ShortName);
    return getLocalizer().matchCompletion(query);
  }

  export function getCategoryParents(
    category: Category
  ): ReadonlyArray<Parent> {
    return EMOJI_DATA.categories[category];
  }

  export function getParent(emoji: Emoji): Parent {
    if (isSkinToneVariant(emoji)) {
      return assert(EMOJI_DATA.parents[emoji], `Missing parent for "${emoji}"`);
    }
    assert(isParent(emoji), `Expected "${emoji}" to be a parent`);
    return emoji;
  }

  export function hasSkinToneVariants(emoji: Parent): boolean {
    return getParentInfo(emoji).skinTones != null;
  }

  export function getDefaultVariant(parent: Parent): Variant {
    return getVariant(parent, SkinTone.None);
  }

  export function getVariant(parent: Parent, skinTone: SkinTone): Variant {
    if (skinTone === SkinTone.None) {
      return parent as Emoji as Variant;
    }
    const { skinTones } = getParentInfo(parent);
    if (skinTones == null) {
      return parent as Emoji as Variant;
    }
    return assert(skinTones[skinTone]);
  }

  export function unsafeCastMaybeInvalidStringToVariant<T extends string>(
    emoji: T extends Emoji ? never : T
  ): Variant {
    return emoji as string as Variant;
  }

  export function ignorePreferredSkinTone(emoji: Emoji): Variant {
    return emoji as Variant;
  }

  export const BAR_CHART = PARENT_AND_ONLY_VARIANT('📊');
  export const BEE = PARENT_AND_ONLY_VARIANT('🐝');
  export const BELL = PARENT_AND_ONLY_VARIANT('🔔');
  export const BIKE = PARENT_AND_ONLY_VARIANT('🚲');
  export const BLACK_CIRCLE = PARENT_AND_ONLY_VARIANT('⚫');
  export const BLUE_HEART = PARENT_AND_ONLY_VARIANT('💙');
  export const BLUSH = PARENT_AND_ONLY_VARIANT('😊');
  export const BULB = PARENT_AND_ONLY_VARIANT('💡');
  export const BUST_IN_SILHOUETTE = PARENT_AND_ONLY_VARIANT('👤');
  export const CAKE = PARENT_AND_ONLY_VARIANT('🍰');
  export const CALENDAR = PARENT_AND_ONLY_VARIANT('📆');
  export const CALL_ME_HAND = PARENT('🤙');
  export const CAMERA = PARENT_AND_ONLY_VARIANT('📷');
  export const CAR = PARENT_AND_ONLY_VARIANT('🚗');
  export const CAT = PARENT_AND_ONLY_VARIANT('🐱');
  export const CHECKMARK = PARENT_AND_ONLY_VARIANT('✅');
  export const CLINKING_GLASSES = PARENT_AND_ONLY_VARIANT('🥂');
  export const COFFEE = PARENT_AND_ONLY_VARIANT('☕');
  export const CONFETTI_BALL = PARENT_AND_ONLY_VARIANT('🎊');
  export const CONFUSED = PARENT_AND_ONLY_VARIANT('😕');
  export const COOL = PARENT_AND_ONLY_VARIANT('🆒');
  export const CREDIT_CARD = PARENT_AND_ONLY_VARIANT('💳');
  export const CRY = PARENT_AND_ONLY_VARIANT('😢');
  export const DOG = PARENT_AND_ONLY_VARIANT('🐶');
  export const DOTTED_LINE_FACE = PARENT_AND_ONLY_VARIANT('🫥');
  export const ELEPHANT = PARENT_AND_ONLY_VARIANT('🐘');
  export const EXPLODING_HEAD = PARENT_AND_ONLY_VARIANT('🤯');
  export const FACE_WITH_SPIRAL_EYES = PARENT_AND_ONLY_VARIANT('😵‍💫');
  export const FERRIS_WHEEL = PARENT_AND_ONLY_VARIANT('🎡');
  export const FIRE = PARENT_AND_ONLY_VARIANT('🔥');
  export const FIREWORK_SPARKLER = PARENT_AND_ONLY_VARIANT('🎇');
  export const FOLDED_HANDS = PARENT('🙏');
  export const FRIED_SHRIMP = PARENT_AND_ONLY_VARIANT('🍤');
  export const GHOST = PARENT_AND_ONLY_VARIANT('👻');
  export const GREEN_CIRCLE = PARENT_AND_ONLY_VARIANT('🟢');
  export const GRIMACING = PARENT_AND_ONLY_VARIANT('😬');
  export const GRINNING = PARENT_AND_ONLY_VARIANT('😀');
  export const HAND = PARENT('✋');
  export const HEART = PARENT_AND_ONLY_VARIANT('❤️');
  export const HEART_ON_FIRE = PARENT_AND_ONLY_VARIANT('❤️‍🔥');
  export const HOUSE = PARENT_AND_ONLY_VARIANT('🏠');
  export const JOY = PARENT_AND_ONLY_VARIANT('😂');
  export const KISSING_HEART = PARENT_AND_ONLY_VARIANT('😘');
  export const LIPSTICK = PARENT_AND_ONLY_VARIANT('💄');
  export const MICROPHONE = PARENT_AND_ONLY_VARIANT('🎤');
  export const MOBILE_PHONE_OFF = PARENT_AND_ONLY_VARIANT('📴');
  export const MONKEY = PARENT_AND_ONLY_VARIANT('🐒');
  export const MOVIE_CAMERA = PARENT_AND_ONLY_VARIANT('🎥');
  export const MUSCLE = PARENT('💪');
  export const NAIL_CARE = PARENT('💅');
  export const NEUTRAL_FACE = PARENT_AND_ONLY_VARIANT('😐');
  export const NO_BELL = PARENT_AND_ONLY_VARIANT('🔕');
  export const OK_HAND = PARENT('👌');
  export const ONE = PARENT_AND_ONLY_VARIANT('1️⃣');
  export const ONE_HUNDRED = PARENT_AND_ONLY_VARIANT('💯');
  export const OPEN_MOUTH = PARENT_AND_ONLY_VARIANT('😮');
  export const PAPERCLIP = PARENT_AND_ONLY_VARIANT('📎');
  export const PARKING = PARENT_AND_ONLY_VARIANT('🅿️');
  export const PLUS = PARENT_AND_ONLY_VARIANT('➕');
  export const POULTRY_LEG = PARENT_AND_ONLY_VARIANT('🍗');
  export const PUSHPIN = PARENT_AND_ONLY_VARIANT('📌');
  export const RAGE = PARENT_AND_ONLY_VARIANT('😡');
  export const REPEAT = PARENT_AND_ONLY_VARIANT('🔁');
  export const ROCKET = PARENT_AND_ONLY_VARIANT('🚀');
  export const ROSE = PARENT_AND_ONLY_VARIANT('🌹');
  export const SHARK = PARENT_AND_ONLY_VARIANT('🦈');
  export const SHRUG = PARENT('🤷');
  export const SHUSHING_FACE = PARENT_AND_ONLY_VARIANT('🤫');
  export const SKULL = PARENT_AND_ONLY_VARIANT('💀');
  export const SLEEPING = PARENT_AND_ONLY_VARIANT('😴');
  export const SLIGHTLY_FROWNING_FACE = PARENT_AND_ONLY_VARIANT('🙁');
  export const SLIGHTLY_SMILING_FACE = PARENT_AND_ONLY_VARIANT('🙂');
  export const SMILE = PARENT_AND_ONLY_VARIANT('😄');
  export const SMILE_CAT = PARENT_AND_ONLY_VARIANT('😸');
  export const SOB = PARENT_AND_ONLY_VARIANT('😭');
  export const SPARKLE = PARENT_AND_ONLY_VARIANT('❇️');
  export const SPARKLES = PARENT_AND_ONLY_VARIANT('✨');
  export const SPARKLING_HEART = PARENT_AND_ONLY_VARIANT('💖');
  export const SPEAKER = PARENT_AND_ONLY_VARIANT('🔈');
  export const SPEECH_BALLOON = PARENT_AND_ONLY_VARIANT('💬');
  export const STAR = PARENT_AND_ONLY_VARIANT('⭐');
  export const STUCK_OUT_TONGUE = PARENT_AND_ONLY_VARIANT('😛');
  export const SUNGLASSES = PARENT_AND_ONLY_VARIANT('😎');
  export const SUNNY = PARENT_AND_ONLY_VARIANT('☀️');
  export const SWEAT_SMILE = PARENT_AND_ONLY_VARIANT('😅');
  export const TADA = PARENT_AND_ONLY_VARIANT('🎉');
  export const THE_HORNS = PARENT('🤘');
  export const THREE = PARENT_AND_ONLY_VARIANT('3️⃣');
  export const THUMBS_DOWN = PARENT('👎');
  export const THUMBS_UP = PARENT('👍');
  export const TOPHAT = PARENT_AND_ONLY_VARIANT('🎩');
  export const TURTLE = PARENT_AND_ONLY_VARIANT('🐢');
  export const TWO = PARENT_AND_ONLY_VARIANT('2️⃣');
  export const WARNING = PARENT_AND_ONLY_VARIANT('⚠️');
  export const WAVE = PARENT('👋');
  export const WEIGHT_LIFTER = PARENT('🏋️');
  export const WHITE_HEART = PARENT_AND_ONLY_VARIANT('🤍');
  export const WILTED_FLOWER = PARENT_AND_ONLY_VARIANT('🥀');
  export const WINK = PARENT_AND_ONLY_VARIANT('😉');
  export const ZIPPER_MOUTH_FACE = PARENT_AND_ONLY_VARIANT('🤐');
  export const ZZZ = PARENT_AND_ONLY_VARIANT('💤');

  const DEFAULT_PREFERRED_REACTION_EMOJI: Array<Parent> = [
    HEART,
    THUMBS_UP,
    THUMBS_DOWN,
    JOY,
    OPEN_MOUTH,
    CRY,
  ];

  export function getDefaultPreferredReactionEmojis(
    skinTone: SkinTone
  ): ReadonlyArray<Variant> {
    return DEFAULT_PREFERRED_REACTION_EMOJI.map(emoji => {
      return getVariant(emoji, skinTone);
    });
  }

  export const CATEGORY_ORDER: ReadonlyArray<Category> = [
    Category.SMILIES_AND_PEOPLE,
    Category.ANIMALS_AND_NATURE,
    Category.FOOD_AND_DRINK,
    Category.TRAVEL_AND_PLACES,
    Category.ACTIVITIES,
    Category.OBJECTS,
    Category.SYMBOLS,
    Category.FLAGS,
  ];

  export const SKIN_TONE_ORDER: ReadonlyArray<SkinTone> = [
    SkinTone.None,
    SkinTone.Type1,
    SkinTone.Type2,
    SkinTone.Type3,
    SkinTone.Type4,
    SkinTone.Type5,
  ];

  export function* iterateAllVariants(): Generator<Variant, void, void> {
    for (const category of Object.values(EMOJI_DATA.categories)) {
      for (const parent of category) {
        yield getDefaultVariant(parent);
        const info = getParentInfo(parent);
        if (info.skinTones != null) {
          for (const skinTone of SKIN_TONE_ORDER) {
            if (skinTone === SkinTone.None) {
              continue;
            }
            yield info.skinTones[skinTone];
          }
        }
      }
    }
  }

  /** @internal */
  function isEmptyString(input: string): boolean {
    return input === '' || input.trim() === '';
  }

  /**
   * Emoji.replaceEmojiWithSpaces()
   * ------------------------------
   */

  const SPACES_CACHE: Record<number, string> = {};
  const MAX_EMOJI_UTF16_LENGTH = 15;

  for (let i = 0; i < MAX_EMOJI_UTF16_LENGTH; i += 1) {
    SPACES_CACHE[i] = ' '.repeat(i);
  }

  export function replaceEmojiWithSpaces(input: string): string {
    if (isEmptyString(input)) {
      return input; // fast path
    }
    const emojiRegex = getEmojiRegex();
    return input.replaceAll(emojiRegex, match => {
      const length = match.length;
      return SPACES_CACHE[length] ?? ' '.repeat(length);
    });
  }

  export function replaceEmojiWithOneSpace(input: string): string {
    if (isEmptyString(input)) {
      return input; // fast path
    }
    const emojiRegex = getEmojiRegex();
    return input.replaceAll(emojiRegex, ' ');
  }

  /**
   * Emoji.stripEmojiFromText()
   * --------------------------
   */

  export function stripEmojiFromText(input: string): string {
    if (isEmptyString(input)) {
      return input; // fast path
    }
    const emojiRegex = getEmojiRegex();
    return input.replaceAll(emojiRegex, '');
  }

  /**
   * Emoji.getMatches()
   * ------------------
   */

  export type Match = Readonly<{
    emoji: Variant;
    offset: number;
  }>;

  const MAX_EMOJI_TO_MATCH = 5000;

  export function* getMatches(input: string): Generator<Match, void, void> {
    if (isEmptyString(input)) {
      return; // fast path
    }

    const emojiRegex = getEmojiRegex();
    let count = 0;
    for (const match of input.matchAll(emojiRegex)) {
      const emoji = match[0];
      if (isEmoji(emoji)) {
        yield {
          emoji: ignorePreferredSkinTone(emoji),
          offset: match.index,
        };
      }
      count += 1;
      if (count >= MAX_EMOJI_TO_MATCH) {
        break;
      }
    }
  }

  /**
   * Emoji.getSegments()
   * -------------------
   */

  export type TextSegment = Readonly<{
    kind: 'text';
    value: string;
    offset: number;
  }>;

  export type EmojiSegment = Readonly<{
    kind: 'emoji';
    value: Variant;
    offset: number;
  }>;

  export type Segment = TextSegment | EmojiSegment;

  export function* getSegments(input: string): Generator<Segment, void, void> {
    if (isEmptyString(input)) {
      yield { kind: 'text', value: input, offset: 0 }; // fast path
      return;
    }

    let cursor = 0;

    // Allow this call to be spied on
    // oxlint-disable-next-line typescript/no-unnecessary-qualifier
    for (const match of Emoji.getMatches(input)) {
      const { offset, emoji } = match;

      if (offset > cursor) {
        const value = input.slice(cursor, offset);
        yield { kind: 'text', value, offset: cursor };
      }

      yield { kind: 'emoji', value: emoji, offset };
      cursor = offset + emoji.length;
    }

    if (cursor < input.length) {
      yield { kind: 'text', value: input.slice(cursor), offset: cursor };
    }
  }

  /**
   * getEmojiOnlyCount()
   * -------------------
   */

  /**
   * Count the number of emoji in some text, returns 0 if there is non-emoji
   * text, or there is too many emoji
   * @internal
   */
  function getEmojiOnlyCount(input: string, limit: number): number {
    if (isEmptyString(input)) {
      return 0; // fast path
    }

    let count = 0;

    // Allow this call to be spied on
    // oxlint-disable-next-line typescript/no-unnecessary-qualifier
    for (const segment of Emoji.getSegments(input)) {
      if (segment.kind === 'text') {
        return 0; // found other text
      }
      if (segment.kind === 'emoji') {
        count += 1;
      }
      if (count > limit) {
        return 0; // too many
      }
    }

    return count;
  }

  /**
   * Emoji.isLoneEmoji()
   * -------------------
   */

  export function isLoneEmoji(input: string): boolean {
    const count = getEmojiOnlyCount(input, 1);
    return count === 1;
  }

  /**
   * Emoji.getJumboEmojiCount()
   * --------------------------
   */

  export type JumboEmojiCount = null | 1 | 2 | 3 | 4 | 5;

  export const MAX_JUMBO_EMOJI_COUNT = 5 satisfies JumboEmojiCount;

  export function getJumboEmojiCount(input: string): JumboEmojiCount {
    const count = getEmojiOnlyCount(input, MAX_JUMBO_EMOJI_COUNT);
    if (count === 0) {
      return null;
    }
    assert(count <= MAX_JUMBO_EMOJI_COUNT);
    return count as JumboEmojiCount;
  }

  /**
   * Localization
   */

  export type EmojiLocaleItem = Readonly<{
    emoji: string;
    tags: ReadonlyArray<string>;
    rank: number;
  }>;

  export type EmojiLocaleData = ReadonlyArray<EmojiLocaleItem>;

  export function setupLocale(localeData: EmojiLocaleData): void {
    const LOCALE_INDEXES = lazy(() => {
      const localeItemsByParent = new Map<Parent, EmojiLocaleItem>();
      for (const item of localeData) {
        if (isParent(item.emoji)) {
          localeItemsByParent.set(item.emoji, item);
        }
      }

      const parentToShortName = new Map<Parent, ShortName>();
      const completionToParent = new Map<CompletionQuery, Parent>();

      const searchIndex: Array<SearchIndexEntry> = [];

      for (const [parent, defaultRank] of ALL_PARENTS_WITH_DEFAULT_RANK()) {
        const info = getParentInfo(parent);
        const item = localeItemsByParent.get(parent);

        let allShortNames = (item?.tags ?? []) as Array<ShortName>;
        allShortNames.push(info.shortName);
        if (info.shortNameAlts != null) {
          allShortNames = allShortNames.concat(info.shortNameAlts);
        }

        const shortName = assert(allShortNames.at(0));
        const shortNameAlts = allShortNames.slice(1);

        parentToShortName.set(parent, shortName);

        const completion = _toEmojiCompletionQuery(shortName);
        const completionAlts = shortNameAlts.map(shortNameAlt => {
          return _toEmojiCompletionQuery(shortNameAlt);
        });

        completionToParent.set(completion, parent);

        searchIndex.push({
          parent,
          rank: item?.rank ?? defaultRank,
          completion,
          completionAlts,
          emoticon: info.emoticon ?? null,
          emoticonAlts: [],
        });
      }

      return { parentToShortName, completionToParent, searchIndex };
    });

    CURRENT_EMOJI_LOCALIZER = {
      getShortName(parent) {
        return (
          LOCALE_INDEXES().parentToShortName.get(parent) ??
          DEFAULT_ENGLISH_LOCALIZER.getShortName(parent)
        );
      },
      matchCompletion(completion) {
        return (
          LOCALE_INDEXES().completionToParent.get(completion) ??
          DEFAULT_ENGLISH_LOCALIZER.matchCompletion(completion)
        );
      },
      getSearchFuses() {
        return createEmojiSearchFuses(LOCALE_INDEXES().searchIndex);
      },
    };
  }

  export function search(input: string, limit = 200): ReadonlyArray<Parent> {
    if (isEmptyString(input)) {
      return []; // fast path
    }

    const fuses = getLocalizer().getSearchFuses();

    const query = _toEmojiCompletionQuery(input.trim() as ShortName);
    const fuse = query.length < 2 ? fuses.getExact() : fuses.getFuzzy();
    const results = fuse.search(query.substring(0, 32));

    const scores = results.map(result => {
      const { item, matches } = result;
      const { parent } = item;

      const match = matches?.[0]?.value;

      let score: number;
      if (item.completion.startsWith(query)) {
        // Primary completion prefix matches in [0,1] range
        score = 1 - query.length / item.completion.length;
      } else if (match != null && match.startsWith(query)) {
        // Alt prefix matches in [1,2] range
        score = 2 - query.length / match.length;
      } else {
        const queryScore = result.score ?? 0;
        const rankScore = item.rank / fuses.size;
        // Other matches in [2,] range ordered by score and rank
        score = 2 + queryScore + rankScore;
      }

      return { parent, score };
    });

    const sorted = scores.toSorted((a, b) => {
      return a.score - b.score;
    });

    return sorted.slice(0, limit).map(result => {
      return result.parent;
    });
  }
}
