// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../../util/assert.std.js';
import type { EmojiParentKey, EmojiVariantKey } from './data/emojis.std.js';
import {
  EmojiSkinTone,
  getEmojiParentKeyByEnglishShortName,
  getEmojiVariantKeyByParentKeyAndSkinTone,
  isEmojiEnglishShortName,
} from './data/emojis.std.js';
import type { PaginatedGifResults } from './panels/FunPanelGifs.dom.js';

function getEmoji(input: string): EmojiParentKey {
  strictAssert(
    isEmojiEnglishShortName(input),
    `Not an emoji short name ${input}`
  );
  return getEmojiParentKeyByEnglishShortName(input);
}

function getSkinToneEmoji(
  input: string,
  skinTone: EmojiSkinTone = EmojiSkinTone.None
): EmojiVariantKey {
  strictAssert(
    isEmojiEnglishShortName(input),
    `Not an emoji short name ${input}`
  );
  const parentKey = getEmojiParentKeyByEnglishShortName(input);
  return getEmojiVariantKeyByParentKeyAndSkinTone(parentKey, skinTone);
}

export const MOCK_THIS_MESSAGE_EMOJIS: ReadonlyArray<EmojiVariantKey> = [
  getSkinToneEmoji('+1', EmojiSkinTone.None),
  getSkinToneEmoji('+1', EmojiSkinTone.Type4),
  getSkinToneEmoji('the_horns', EmojiSkinTone.Type1),
  getSkinToneEmoji('the_horns', EmojiSkinTone.Type2),
  getSkinToneEmoji('smile'),
  getSkinToneEmoji('sweat_smile'),
];

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

export const MOCK_GIFS_PAGINATED_ONE_PAGE: PaginatedGifResults = {
  next: null,
  gifs: Array.from({ length: 30 }, (_, i) => {
    return {
      id: String(i),
      title: '',
      description: '',
      previewMedia: {
        url: 'https://media2.giphy.com/media/v1.Y2lkPTZhNGNmY2JhaXFlbXZxcHVjNXlmaGdlYWs1dTlwYnNrb2I5aGttbXViYjh4Z2hqbyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3kzJvEciJa94SMW3hN/200w.mp4',
        width: 200,
        height: 178,
      },
      attachmentMedia: {
        url: 'https://media2.giphy.com/media/v1.Y2lkPTZhNGNmY2JhaXFlbXZxcHVjNXlmaGdlYWs1dTlwYnNrb2I5aGttbXViYjh4Z2hqbyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3kzJvEciJa94SMW3hN/giphy.mp4',
        width: 480,
        height: 418,
      },
    };
  }),
};
