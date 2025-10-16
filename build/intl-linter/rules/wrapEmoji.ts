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
import { rule } from '../utils/rule.std.js';

function isEmojifyTag(
  element: MessageFormatElement | null
): element is TagElement {
  return (
    element != null && isTagElement(element) && element.value === 'emojify'
  );
}

export default rule('wrapEmoji', context => {
  const emojiRegex = getEmojiRegex();
  return {
    enterTag(element) {
      if (!isEmojifyTag(element)) {
        return;
      }

      if (element.children.length !== 1) {
        // multiple children
        context.report(
          'Only use a single literal emoji in <emojify> tags with no additional text.',
          element.location
        );
        return;
      }

      const child = element.children[0];
      if (!isLiteralElement(child)) {
        // non-literal
        context.report(
          'Only use a single literal emoji in <emojify> tags with no additional text.',
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

      if (!isEmojifyTag(parent)) {
        // unwrapped
        context.report(
          'Use <emojify> to wrap emoji in translation strings.',
          element.location
        );
        return;
      }

      const emoji = match[0];
      if (emoji !== element.value) {
        // extra text other than emoji
        context.report(
          'Only use a single literal emoji in <emojify> tags with no additional text.',
          element.location
        );
      }
    },
  };
});
