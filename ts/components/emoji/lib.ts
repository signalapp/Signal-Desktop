// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Camelcase disabled due to emoji-datasource using snake_case
/* eslint-disable camelcase */
import { groupBy, keyBy, mapValues, sortBy } from 'lodash';
import { getOwn } from '../../util/getOwn';
import {
  EMOJI_SKIN_TONE_TO_KEY,
  EmojiSkinTone,
  KEY_TO_EMOJI_SKIN_TONE,
} from '../fun/data/emojis';
import { strictAssert } from '../../util/assert';

// Import emoji-datasource dynamically to avoid costly typechecking.
// eslint-disable-next-line import/no-dynamic-require, @typescript-eslint/no-var-requires
const untypedData = require('emoji-datasource' as string);

export const skinTones = ['1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF'];

export type SkinToneKey = '1F3FB' | '1F3FC' | '1F3FD' | '1F3FE' | '1F3FF';

type EmojiSkinVariation = {
  unified: string;
  non_qualified: null;
  image: string;
  sheet_x: number;
  sheet_y: number;
  added_in: string;
  has_img_apple: boolean;
  has_img_google: boolean;
  has_img_twitter: boolean;
  has_img_emojione: boolean;
  has_img_facebook: boolean;
  has_img_messenger: boolean;
};

export type EmojiData = {
  name: string;
  unified: string;
  non_qualified: string | null;
  docomo: string | null;
  au: string | null;
  softbank: string | null;
  google: string | null;
  image: string;
  sheet_x: number;
  sheet_y: number;
  short_name: string;
  short_names: Array<string>;
  text: string | null;
  texts: Array<string> | null;
  category: string;
  sort_order: number;
  added_in: string;
  has_img_apple: boolean;
  has_img_google: boolean;
  has_img_twitter: boolean;
  has_img_facebook: boolean;
  skin_variations?: {
    [key: string]: EmojiSkinVariation;
  };
};

export const data = (untypedData as Array<EmojiData>)
  .filter(emoji => emoji.has_img_apple)
  .map(emoji =>
    // Why this weird map?
    // the emoji dataset has two separate categories for Emotions and People
    // yet in our UI we display these as a single merged category. In order
    // for the emojis to be sorted properly we're manually incrementing the
    // sort_order for the People & Body emojis so that they fall below the
    // Smiley & Emotions category.
    emoji.category === 'People & Body'
      ? { ...emoji, sort_order: emoji.sort_order + 1000 }
      : emoji
  );

const dataByShortName = keyBy(data, 'short_name');
const dataByEmoji: { [key: string]: EmojiData } = {};

export const dataByCategory = mapValues(
  groupBy(data, ({ category }) => {
    if (category === 'Activities') {
      return 'activity';
    }

    if (category === 'Animals & Nature') {
      return 'animal';
    }

    if (category === 'Flags') {
      return 'flag';
    }

    if (category === 'Food & Drink') {
      return 'food';
    }

    if (category === 'Objects') {
      return 'object';
    }

    if (category === 'Travel & Places') {
      return 'travel';
    }

    if (category === 'Smileys & Emotion') {
      return 'emoji';
    }

    if (category === 'People & Body') {
      return 'emoji';
    }

    if (category === 'Symbols') {
      return 'symbol';
    }

    return 'misc';
  }),
  arr => sortBy(arr, 'sort_order')
);

export function getEmojiData(
  shortName: keyof typeof dataByShortName,
  emojiSkinToneDefault: EmojiSkinTone
): EmojiData | EmojiSkinVariation {
  const base = dataByShortName[shortName];
  const variation = EMOJI_SKIN_TONE_TO_KEY.get(emojiSkinToneDefault);

  if (variation != null && base.skin_variations) {
    if (base.skin_variations[variation]) {
      return base.skin_variations[variation];
    }

    // For emojis that have two people in them which can have diff skin tones
    // the Map is of SkinTone-SkinTone. If we don't find the correct skin tone
    // in the list of variations then we assume it is one of those double skin
    // emojis and we default to both people having same skin.
    return base.skin_variations[`${variation}-${variation}`];
  }

  return base;
}

export function unifiedToEmoji(unified: string): string {
  return unified
    .split('-')
    .map(c => String.fromCodePoint(parseInt(c, 16)))
    .join('');
}

export function convertShortNameToData(
  shortName: string,
  skinTone: EmojiSkinTone
): EmojiData | undefined {
  const base = dataByShortName[shortName];

  if (!base) {
    return undefined;
  }

  if (skinTone !== EmojiSkinTone.None && base.skin_variations != null) {
    const toneKey = EMOJI_SKIN_TONE_TO_KEY.get(skinTone);
    strictAssert(toneKey, `Missing key for skin tone: ${skinTone}`);
    const variation =
      base.skin_variations[toneKey] ??
      base.skin_variations[`${toneKey}-${toneKey}`];
    if (variation) {
      return {
        ...base,
        ...variation,
      };
    }
  }

  return base;
}

export function convertShortName(
  shortName: string,
  skinTone: EmojiSkinTone
): string {
  const emojiData = convertShortNameToData(shortName, skinTone);

  if (!emojiData) {
    return '';
  }

  return unifiedToEmoji(emojiData.unified);
}

export function emojiToData(emoji: string): EmojiData | undefined {
  return getOwn(dataByEmoji, emoji);
}

data.forEach(emoji => {
  const { short_name, short_names, skin_variations } = emoji;

  if (short_names) {
    short_names.forEach(name => {
      dataByShortName[name] = emoji;
    });
  }

  dataByEmoji[convertShortName(short_name, EmojiSkinTone.None)] = emoji;

  if (skin_variations) {
    Object.entries(skin_variations).forEach(([tone]) => {
      const emojiSkinTone = KEY_TO_EMOJI_SKIN_TONE.get(tone);
      if (emojiSkinTone != null) {
        dataByEmoji[convertShortName(short_name, emojiSkinTone)] = emoji;
      }
    });
  }
});
