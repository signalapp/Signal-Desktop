// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../../util/assert';
import type { EmojiParentKey } from './data/emojis';
import {
  getEmojiParentKeyByEnglishShortName,
  isEmojiEnglishShortName,
} from './data/emojis';
import type { GifsPaginated } from './data/gifs';

function getEmoji(input: string): EmojiParentKey {
  strictAssert(
    isEmojiEnglishShortName(input),
    `Not an emoji short name ${input}`
  );
  return getEmojiParentKeyByEnglishShortName(input);
}

export const MOCK_RECENT_EMOJIS: ReadonlyArray<EmojiParentKey> = [
  getEmoji('grinning'),
  getEmoji('grin'),
  getEmoji('joy'),
  getEmoji('rolling_on_the_floor_laughing'),
  getEmoji('smiley'),
  getEmoji('smile'),
  getEmoji('sweat_smile'),
  getEmoji('laughing'),
  getEmoji('wink'),
  getEmoji('blush'),
  getEmoji('yum'),
  getEmoji('sunglasses'),
  getEmoji('heart_eyes'),
  getEmoji('kissing_heart'),
  getEmoji('kissing'),
  getEmoji('kissing_smiling_eyes'),
  getEmoji('kissing_closed_eyes'),
  getEmoji('relaxed'),
  getEmoji('slightly_smiling_face'),
  getEmoji('hugging_face'),
  getEmoji('grinning_face_with_star_eyes'),
  getEmoji('thinking_face'),
  getEmoji('face_with_one_eyebrow_raised'),
  getEmoji('neutral_face'),
  getEmoji('expressionless'),
  getEmoji('no_mouth'),
  getEmoji('face_with_rolling_eyes'),
  getEmoji('smirk'),
  getEmoji('persevere'),
  getEmoji('disappointed_relieved'),
  getEmoji('open_mouth'),
  getEmoji('zipper_mouth_face'),
];

export const MOCK_GIFS_PAGINATED_EMPTY: GifsPaginated = {
  next: null,
  gifs: [],
};

export const MOCK_GIFS_PAGINATED_ONE_PAGE: GifsPaginated = {
  next: null,
  gifs: Array.from({ length: 30 }, (_, i) => {
    return {
      id: String(i),
      title: '',
      description: '',
      previewMedia: {
        url: 'https://media.tenor.com/ihqN6a3iiYEAAAPo/pikachu-shocked-face-stunned.mp4',
        width: 640,
        height: 640,
      },
      attachmentMedia: {
        url: 'https://media.tenor.com/ihqN6a3iiYEAAAPo/pikachu-shocked-face-stunned.mp4',
        width: 640,
        height: 640,
      },
    };
  }),
};
