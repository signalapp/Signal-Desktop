// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter';
import type Quill from '@signalapp/quill-cjs';

import * as log from '../../logging/log';
import type { EmojiData } from '../../components/emoji/lib';
import {
  convertShortName,
  convertShortNameToData,
} from '../../components/emoji/lib';

type AutoSubstituteAsciiEmojisOptions = {
  skinTone: number;
};

const emojiMap: Record<string, string> = {
  ':-)': 'slightly_smiling_face',
  ':-(': 'slightly_frowning_face',
  ':-D': 'grinning',
  ':-*': 'kissing_heart',
  ':-P': 'stuck_out_tongue',
  ':-p': 'stuck_out_tongue',
  ":'(": 'cry',
  ':-\\': 'confused',
  ':-|': 'neutral_face',
  ';-)': 'wink',
  '(Y)': '+1',
  '(N)': '-1',
  '(y)': '+1',
  '(n)': '-1',
  '<3': 'heart',
  '^_^': 'grin',
};

function buildRegexp(obj: Record<string, string>): RegExp {
  const sanitizedKeys = Object.keys(obj).map(x =>
    x.replace(/([^a-zA-Z0-9])/g, '\\$1')
  );

  return new RegExp(`(${sanitizedKeys.join('|')})$`);
}

const EMOJI_REGEXP = buildRegexp(emojiMap);

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

  onTextChange(): void {
    if (!window.storage.get('autoConvertEmoji', true)) {
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
    const emojiName = emojiMap[textEmoji];

    const emojiData = convertShortNameToData(emojiName, this.options.skinTone);
    if (emojiData) {
      this.insertEmoji(
        emojiData,
        range.index - textEmoji.length,
        textEmoji.length,
        textEmoji
      );
    }
  }

  insertEmoji(
    emojiData: EmojiData,
    index: number,
    range: number,
    source: string
  ): void {
    const emoji = convertShortName(emojiData.short_name, this.options.skinTone);
    const delta = new Delta()
      .retain(index)
      .delete(range)
      .insert({
        emoji: { value: emoji, source },
      });
    this.quill.updateContents(delta, 'api');
    this.quill.setSelection(index + 1, 0);
  }
}
