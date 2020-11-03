// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import Parchment from 'parchment';
import Quill from 'quill';
import { render } from 'react-dom';
import { Emojify } from '../../components/conversation/Emojify';
import { ConversationType } from '../../state/ducks/conversations';

const Embed: typeof Parchment.Embed = Quill.import('blots/embed');

type MentionBlotValue = { uuid?: string; title?: string };

export class MentionBlot extends Embed {
  static blotName = 'mention';

  static className = 'mention-blot';

  static tagName = 'span';

  static create(value: ConversationType): Node {
    const node = super.create(undefined) as HTMLElement;

    MentionBlot.buildSpan(value, node);

    return node;
  }

  static value(node: HTMLElement): MentionBlotValue {
    const { uuid, title } = node.dataset;
    return {
      uuid,
      title,
    };
  }

  static buildSpan(member: ConversationType, node: HTMLElement): void {
    node.setAttribute('data-uuid', member.uuid || '');
    node.setAttribute('data-title', member.title || '');

    const mentionSpan = document.createElement('span');

    render(
      <span className="module-composition-input__at-mention">
        <bdi>
          @
          <Emojify text={member.title} />
        </bdi>
      </span>,
      mentionSpan
    );

    node.appendChild(mentionSpan);
  }
}
