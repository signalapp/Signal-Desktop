import React from 'react';
import Parchment from 'parchment';
import Quill from 'quill';
import { render } from 'react-dom';

import { Emoji } from '../../components/emoji/Emoji';

const Embed: typeof Parchment.Embed = Quill.import('blots/embed');

export class EmojiBlot extends Embed {
  static blotName = 'emoji';

  static tagName = 'span';

  static className = 'emoji-blot';

  static create(emoji: string): Node {
    const node = super.create(undefined) as HTMLElement;
    node.dataset.emoji = emoji;

    const emojiSpan = document.createElement('span');
    render(
      <Emoji emoji={emoji} inline size={20}>
        {emoji}
      </Emoji>,
      emojiSpan
    );
    node.appendChild(emojiSpan);

    return node;
  }

  static value(node: HTMLElement): string | undefined {
    return node.dataset.emoji;
  }
}
