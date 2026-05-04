// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';
import type Quill from '@signalapp/quill-cjs';

import { createLogger } from '../../logging/log.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

const log = createLogger('index');

export type AutoSubstituteAsciiEmojisOptions = {
  emojiSkinToneDefault: Emoji.SkinTone | null;
};

type EmojiShortcutMap = Partial<Record<string, Emoji.Parent>>;

const emojiShortcutMap: EmojiShortcutMap = {
  ':-)': Emoji.SLIGHTLY_SMILING_FACE,
  ':-(': Emoji.SLIGHTLY_FROWNING_FACE,
  ':-D': Emoji.GRINNING,
  ':-*': Emoji.KISSING_HEART,
  ':-P': Emoji.STUCK_OUT_TONGUE,
  ':-p': Emoji.STUCK_OUT_TONGUE,
  ":'(": Emoji.CRY,
  ':-\\': Emoji.CONFUSED,
  ':-|': Emoji.NEUTRAL_FACE,
  ';-)': Emoji.WINK,
  '(Y)': Emoji.THUMBS_UP,
  '(N)': Emoji.THUMBS_UP,
  '(y)': Emoji.THUMBS_UP,
  '(n)': Emoji.THUMBS_DOWN,
  '<3': Emoji.HEART,
  '^_^': Emoji.GRINNING,
};

function buildRegexp(obj: EmojiShortcutMap): RegExp {
  const sanitizedKeys = Object.keys(obj).map(x =>
    x.replace(/([^a-zA-Z0-9])/g, '\\$1')
  );

  return new RegExp(`(${sanitizedKeys.join('|')})$`);
}

type EmojiRegExpMatch = RegExpExecArray & { 1: string };
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

    const [, textEmoji] = match as EmojiRegExpMatch;
    const emoji = emojiShortcutMap[textEmoji];

    if (emoji != null) {
      this.insertEmoji(
        emoji,
        range.index - textEmoji.length,
        textEmoji.length,
        textEmoji
      );
    }
  }

  insertEmoji(
    parent: Emoji.Parent,
    index: number,
    range: number,
    source: string
  ): void {
    const value = Emoji.getVariant(
      parent,
      this.options.emojiSkinToneDefault ?? Emoji.SkinTone.None
    );
    const delta = new Delta().retain(index).delete(range).insert({
      emoji: { value, source },
    });
    this.quill.updateContents(delta, 'api');
    this.quill.setSelection(index + 1, 0);
  }
}
