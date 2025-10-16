// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EmbedBlot from '@signalapp/quill-cjs/blots/embed.js';
import { strictAssert } from '../../util/assert.std.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../../components/fun/data/emojis.std.js';
import {
  createStaticEmojiBlot,
  FUN_STATIC_EMOJI_CLASS,
} from '../../components/fun/FunEmoji.dom.js';

// the DOM structure of this EmojiBlot should match the other emoji implementations:
// ts/components/fun/FunEmoji.tsx

export type EmojiBlotValue = Readonly<{
  value: string;
  source?: string;
}>;

export class EmojiBlot extends EmbedBlot {
  static override blotName = 'emoji';

  // See `createStaticEmojiBlot()`
  static override tagName = 'img';

  static override className = FUN_STATIC_EMOJI_CLASS;

  static override create({ value: emoji, source }: EmojiBlotValue): Node {
    const node = super.create(undefined) as HTMLImageElement;

    strictAssert(isEmojiVariantValue(emoji), 'Value is not a known emoji');
    const variantKey = getEmojiVariantKeyByValue(emoji);
    const variant = getEmojiVariantByKey(variantKey);

    createStaticEmojiBlot(node, {
      role: 'img',
      'aria-label': emoji,
      emoji: variant,
      size: 20,
    });
    node.setAttribute('data-emoji', emoji);
    node.setAttribute('data-emoji', emoji);
    node.setAttribute('data-source', source ?? '');

    return node;
  }

  static override value(node: HTMLElement): EmojiBlotValue | undefined {
    const { emoji, source } = node.dataset;
    if (emoji === undefined) {
      throw new Error(
        `Failed to make EmojiBlot with emoji: ${emoji}, source: ${source}`
      );
    }

    return { value: emoji, source };
  }
}
