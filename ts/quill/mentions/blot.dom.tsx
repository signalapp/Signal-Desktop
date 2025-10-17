// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import EmbedBlot from '@signalapp/quill-cjs/blots/embed.js';
import { createRoot } from 'react-dom/client';

import { Emojify } from '../../components/conversation/Emojify.dom.js';
import { normalizeAci } from '../../util/normalizeAci.std.js';
import type { MentionBlotValue } from '../util.dom.js';
import { FunEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider.dom.js';
import { AxoProvider } from '../../axo/AxoProvider.dom.js';

const { i18n } = window.SignalContext;

export class MentionBlot extends EmbedBlot {
  static override blotName = 'mention';

  static override className = 'mention-blot';

  static override tagName = 'span';

  static override create(value: MentionBlotValue): Node {
    const node = super.create(undefined) as HTMLElement;

    MentionBlot.buildSpan(value, node);

    return node;
  }

  static override value(node: HTMLElement): MentionBlotValue {
    const { aci, title } = node.dataset;
    if (aci === undefined || title === undefined) {
      throw new Error(
        `Failed to make MentionBlot with aci: ${aci}, title: ${title}`
      );
    }

    return {
      aci: normalizeAci(aci, 'quill mention blot'),
      title,
    };
  }

  static buildSpan(mention: MentionBlotValue, node: HTMLElement): void {
    node.setAttribute('data-aci', mention.aci || '');
    node.setAttribute('data-title', mention.title || '');
    node.setAttribute('contenteditable', 'false');

    const mentionSpan = document.createElement('span');

    createRoot(mentionSpan).render(
      <StrictMode>
        <AxoProvider dir={i18n.getLocaleDirection()}>
          <FunEmojiLocalizationProvider i18n={i18n}>
            <span className="module-composition-input__at-mention">
              <bdi>
                @
                <Emojify text={mention.title} />
              </bdi>
            </span>
          </FunEmojiLocalizationProvider>
        </AxoProvider>
      </StrictMode>
    );

    node.appendChild(mentionSpan);
  }
}
