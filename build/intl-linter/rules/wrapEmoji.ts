// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import getEmojiRegex from 'emoji-regex';
import type {
  MessageFormatElement,
  TagElement,
} from '@formatjs/icu-messageformat-parser';
import {
  isTagElement,
  isLiteralElement,
} from '@formatjs/icu-messageformat-parser';
import { rule } from '../utils/rule';

function isEmojiTag(
  element: MessageFormatElement | null
): element is TagElement {
  return element != null && isTagElement(element) && element.value === 'emoji';
}

export default rule('wrapEmoji', context => {
  const emojiRegex = getEmojiRegex();
  return {
    enterTag(element) {
      if (!isEmojiTag(element)) {
        return;
      }

      if (element.children.length !== 1) {
        // multiple children
        context.report(
          'Only use a single literal emoji in <emoji> tags with no additional text.',
          element.location
        );
        return;
      }

      const child = element.children[0];
      if (!isLiteralElement(child)) {
        // non-literal
        context.report(
          'Only use a single literal emoji in <emoji> tags with no additional text.',
          child.location
        );
      }
    },
    enterLiteral(element, parent) {
      const match = element.value.match(emojiRegex);
      if (match == null) {
        // no emoji
        return;
      }

      if (!isEmojiTag(parent)) {
        // unwrapped
        context.report(
          'Use <emoji> to wrap emoji in translation strings.',
          element.location
        );
        return;
      }

      const emoji = match[0];
      if (emoji !== element.value) {
        // extra text other than emoji
        context.report(
          'Only use a single literal emoji in <emoji> tags with no additional text.',
          element.location
        );
      }
    },
  };
});
