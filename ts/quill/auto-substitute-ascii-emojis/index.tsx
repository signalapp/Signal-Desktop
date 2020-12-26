// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Quill from 'quill';
import Delta from 'quill-delta';
import _ from 'lodash';
import {
  convertShortName,
  convertShortNameToData,
  EmojiData,
} from '../../components/emoji/lib';
import { EmojiPickDataType } from '../../components/emoji/EmojiPicker';

interface AutoSubstituteAsciiEmojisOptions {
  onPickEmoji: (emoji: EmojiPickDataType) => void;
  setEmojiPickerElement: (element: JSX.Element | null) => void;
  skinTone: number;
}

const emojiMap: Record<string, string> = {
  ':)': 'slightly_smiling_face',
  ':(': 'slightly_frowning_face',
  ':D': 'grinning',
  ':-*': 'kissing',
  ':*': 'kissing',
};

export class AutoSubstituteAsciiEmojis {
  options: AutoSubstituteAsciiEmojisOptions;

  quill: Quill;

  constructor(quill: Quill, options: AutoSubstituteAsciiEmojisOptions) {
    this.options = options;
    this.quill = quill;

    this.quill.on(
      'text-change',
      _.debounce(() => this.onTextChange(), 0)
    );
  }

  onTextChange(): void {
    if (!window.Events.getAutoSubstituteAsciiEmojis()) {
      return;
    }

    const range = this.quill.getSelection();

    if (!range) return;

    const [blot, index] = this.quill.getLeaf(range.index);

    if (blot !== undefined && blot.text !== undefined) {
      const blotText: string = blot.text;
      Object.entries(emojiMap).some(([textEmoji, emojiName]) => {
        if (blotText.substring(0, index).endsWith(textEmoji)) {
          const emojiData = convertShortNameToData(
            emojiName,
            this.options.skinTone
          );
          if (emojiData) {
            this.insertEmoji(
              emojiData,
              range.index - textEmoji.length,
              textEmoji.length
            );
            return true;
          }
        }
        return false;
      });
    }
  }

  insertEmoji(emojiData: EmojiData, index: number, range: number): void {
    const emoji = convertShortName(emojiData.short_name, this.options.skinTone);
    const delta = new Delta().retain(index).delete(range).insert({emoji});
    this.quill.updateContents(delta, 'user');
    this.quill.setSelection(index + 1, 0);
  }
}
