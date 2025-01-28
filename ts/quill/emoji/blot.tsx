// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EmbedBlot from '@signalapp/quill-cjs/blots/embed';

import { emojiToImage } from '../../components/emoji/lib';

// the DOM structure of this EmojiBlot should match the other emoji implementations:
// ts/components/conversation/Emojify.tsx
// ts/components/emoji/Emoji.tsx

export type EmojiBlotValue = Readonly<{
  value: string;
  source?: string;
}>;

export class EmojiBlot extends EmbedBlot {
  static override blotName = 'emoji';

  static override tagName = 'img';

  static override className = 'emoji-blot';

  static override create({ value: emoji, source }: EmojiBlotValue): Node {
    const node = super.create(undefined) as HTMLElement;
    node.dataset.emoji = emoji;
    node.dataset.source = source;

    const image = emojiToImage(emoji);

    node.setAttribute('src', image || '');
    node.setAttribute('data-emoji', emoji);
    node.setAttribute('data-source', source || '');
    node.setAttribute('title', emoji);
    node.setAttribute('aria-label', emoji);

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
