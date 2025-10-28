// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';
import type Quill from '@signalapp/quill-cjs';

import { createLogger } from '../../logging/log.std.js';
import type { EmojiParentKey } from '../../components/fun/data/emojis.std.js';
import {
  EMOJI_PARENT_KEY_CONSTANTS,
  EmojiSkinTone,
  getEmojiVariantByParentKeyAndSkinTone,
} from '../../components/fun/data/emojis.std.js';

const log = createLogger('index');

export type AutoSubstituteAsciiEmojisOptions = {
  emojiSkinToneDefault: EmojiSkinTone | null;
};

type EmojiShortcutMap = Partial<Record<string, EmojiParentKey>>;

const emojiShortcutMap: EmojiShortcutMap = {
  ':-)': EMOJI_PARENT_KEY_CONSTANTS.SLIGHTLY_SMILING_FACE,
  ':-(': EMOJI_PARENT_KEY_CONSTANTS.SLIGHTLY_FROWNING_FACE,
  ':-D': EMOJI_PARENT_KEY_CONSTANTS.GRINNING_FACE,
  ':-*': EMOJI_PARENT_KEY_CONSTANTS.FACE_BLOWING_A_KISS,
  ':-P': EMOJI_PARENT_KEY_CONSTANTS.FACE_WITH_STUCK_OUT_TONGUE,
  ':-p': EMOJI_PARENT_KEY_CONSTANTS.FACE_WITH_STUCK_OUT_TONGUE,
  ":'(": EMOJI_PARENT_KEY_CONSTANTS.CRYING_FACE,
  ':-\\': EMOJI_PARENT_KEY_CONSTANTS.CONFUSED_FACE,
  ':-|': EMOJI_PARENT_KEY_CONSTANTS.NEUTRAL_FACE,
  ';-)': EMOJI_PARENT_KEY_CONSTANTS.WINKING_FACE,
  '(Y)': EMOJI_PARENT_KEY_CONSTANTS.THUMBS_UP,
  '(N)': EMOJI_PARENT_KEY_CONSTANTS.THUMBS_UP,
  '(y)': EMOJI_PARENT_KEY_CONSTANTS.THUMBS_UP,
  '(n)': EMOJI_PARENT_KEY_CONSTANTS.THUMBS_DOWN,
  '<3': EMOJI_PARENT_KEY_CONSTANTS.RED_HEART,
  '^_^': EMOJI_PARENT_KEY_CONSTANTS.GRINNING_FACE,
};

function buildRegexp(obj: EmojiShortcutMap): RegExp {
  const sanitizedKeys = Object.keys(obj).map(x =>
    x.replace(/([^a-zA-Z0-9])/g, '\\$1')
  );

  return new RegExp(`(${sanitizedKeys.join('|')})$`);
}

const EMOJI_REGEXP = buildRegexp(emojiShortcutMap);

let isEnabled = true;

export class AutoSubstituteAsciiEmojis {
  options: AutoSubstituteAsciiEmojisOptions;

  quill: Quill;

  constructor(quill: Quill, options: AutoSubstituteAsciiEmojisOptions) {
    this.options = options;
    this.quill = quill;

    this.quill.on(Emitter.events.TEXT_CHANGE, (_now, _before, source) => {
      if (source !== 'user') {
        return;
      }

      // When pasting - Quill first updates contents with "user" source and only
      // then updates the selection with "silent" source. This means that unless
      // we wrap `onTextChange` with setTimeout - we are not going to see the
      // updated cursor position.
      setTimeout(() => this.onTextChange(), 0);
    });
  }

  static enable(value: boolean): void {
    isEnabled = value;
  }

  onTextChange(): void {
    if (!isEnabled) {
      return;
    }

    const range = this.quill.getSelection();

    if (!range) {
      return;
    }

    const [blot, index] = this.quill.getLeaf(range.index);

    const text = blot?.value();
    if (!text) {
      return;
    }
    if (typeof text !== 'string') {
      log.error(
        'AutoSubstituteAsciiEmojis: returned blot value was not a string'
      );
      return;
    }

    const textBeforeCursor = text.slice(0, index);
    const match = textBeforeCursor.match(EMOJI_REGEXP);
    if (match == null) {
      return;
    }

    const [, textEmoji] = match;
    const emojiParentKey = emojiShortcutMap[textEmoji];

    if (emojiParentKey != null) {
      this.insertEmoji(
        emojiParentKey,
        range.index - textEmoji.length,
        textEmoji.length,
        textEmoji
      );
    }
  }

  insertEmoji(
    emojiParentKey: EmojiParentKey,
    index: number,
    range: number,
    source: string
  ): void {
    const emojiVariant = getEmojiVariantByParentKeyAndSkinTone(
      emojiParentKey,
      this.options.emojiSkinToneDefault ?? EmojiSkinTone.None
    );
    const delta = new Delta()
      .retain(index)
      .delete(range)
      .insert({
        emoji: { value: emojiVariant.value, source },
      });
    this.quill.updateContents(delta, 'api');
    this.quill.setSelection(index + 1, 0);
  }
}
