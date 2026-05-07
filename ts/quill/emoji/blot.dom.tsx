// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// EmbedBlot from `@signalapp/quill-cjs` wraps the element with `\uFEFF` guards
// that prevent mouse cursor adjustment when clicking the blot.
import { EmbedBlot } from '@signalapp/parchment-cjs';
import {
  createStaticEmojiBlot,
  FUN_STATIC_EMOJI_CLASS,
  getFunEmojiElementValue,
} from '../../components/fun/FunEmoji.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';

// the DOM structure of this EmojiBlot should match the other emoji implementations:
// ts/components/fun/FunEmoji.tsx

export type EmojiBlotValue = Readonly<{
  value: Emoji.Variant;
  source?: string;
}>;

export class EmojiBlot extends EmbedBlot {
  static override blotName = 'emoji';

  // See `createStaticEmojiBlot()`
  static override tagName = 'span';

  static override className = FUN_STATIC_EMOJI_CLASS;

  static override create({ value, source }: EmojiBlotValue): Node {
    const node = super.create(undefined) as HTMLSpanElement;

    createStaticEmojiBlot(node, {
      role: 'img',
      'aria-label': Emoji.getDisplayLabel(value),
      emoji: value,
      size: 20,
    });
    node.setAttribute('data-emoji', value);
    node.setAttribute('data-source', source ?? '');
    node.setAttribute('contenteditable', 'false');

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
