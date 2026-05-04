// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PaginatedGifResults } from '../components/fun/panels/FunPanelGifs.dom.tsx';
import { Emoji } from '../axo/emoji.std.ts';
import { strictAssert } from '../util/assert.std.ts';

function getEmoji(input: string): Emoji.Parent {
  strictAssert(Emoji.isParent(input), 'Invalid emoji parent value');
  return input;
}

function getSkinToneEmoji(input: string, skinTone: Emoji.SkinTone) {
  return Emoji.getVariant(getEmoji(input), skinTone);
}

export const MOCK_THIS_MESSAGE_EMOJIS: ReadonlyArray<Emoji.Variant> = [
  getSkinToneEmoji('👍', Emoji.SkinTone.None),
  getSkinToneEmoji('👍', Emoji.SkinTone.Type4),
  getSkinToneEmoji('🤘', Emoji.SkinTone.Type1),
  getSkinToneEmoji('🤘', Emoji.SkinTone.Type2),
  getSkinToneEmoji('😄', Emoji.SkinTone.None),
  getSkinToneEmoji('😅', Emoji.SkinTone.None),
];

export const MOCK_RECENT_EMOJIS: ReadonlyArray<Emoji.Parent> = [
  getEmoji('😀'),
  getEmoji('😁'),
  getEmoji('😂'),
  getEmoji('🤣'),
  getEmoji('😃'),
  getEmoji('😄'),
  getEmoji('😅'),
  getEmoji('😆'),
  getEmoji('😉'),
  getEmoji('😊'),
  getEmoji('😋'),
  getEmoji('😎'),
  getEmoji('😍'),
  getEmoji('😘'),
  getEmoji('😗'),
  getEmoji('😙'),
  getEmoji('😚'),
  getEmoji('☺️'),
  getEmoji('🙂'),
  getEmoji('🤗'),
  getEmoji('🤩'),
  getEmoji('🤔'),
  getEmoji('🤨'),
  getEmoji('😐'),
  getEmoji('😑'),
  getEmoji('😶'),
  getEmoji('🙄'),
  getEmoji('😏'),
  getEmoji('😣'),
  getEmoji('😥'),
  getEmoji('😮'),
  getEmoji('🤐'),
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
