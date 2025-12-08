// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EmbedBlot from '@signalapp/quill-cjs/blots/embed.js';
import type { EmojiVariantValue } from '../../components/fun/data/emojis.std.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
} from '../../components/fun/data/emojis.std.js';
import {
  createStaticEmojiBlot,
  FUN_STATIC_EMOJI_CLASS,
  getFunEmojiElementValue,
} from '../../components/fun/FunEmoji.dom.js';

// the DOM structure of this EmojiBlot should match the other emoji implementations:
// ts/components/fun/FunEmoji.tsx

export type EmojiBlotValue = Readonly<{
  value: EmojiVariantValue;
  source?: string;
}>;

export class EmojiBlot extends EmbedBlot {
  static override blotName = 'emoji';

  // See `createStaticEmojiBlot()`
  static override tagName = 'img';

  static override className = FUN_STATIC_EMOJI_CLASS;

  static override create({ value: emoji, source }: EmojiBlotValue): Node {
    const node = super.create(undefined) as HTMLImageElement;

    const variantKey = getEmojiVariantKeyByValue(emoji);
    const variant = getEmojiVariantByKey(variantKey);

    createStaticEmojiBlot(node, {
      role: 'img',
      'aria-label': emoji,
      emoji: variant,
      size: 20,
    });
    node.setAttribute('data-emoji-key', variantKey);
    node.setAttribute('data-emoji-value', emoji);
    node.setAttribute('data-source', source ?? '');

    return node;
  }

  static override value(node: HTMLElement): EmojiBlotValue | undefined {
    const emoji = getFunEmojiElementValue(node);
    const { source } = node.dataset;

    if (emoji == null) {
      throw new Error(
        `Failed to make EmojiBlot with emoji: ${emoji}, source: ${source}`
      );
    }

    return { value: emoji, source };
  }
}
