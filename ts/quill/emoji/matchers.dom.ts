// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';

import { insertEmojiOps } from '../util.dom.js';
import type { Matcher } from '../util.dom.js';
import {
  FUN_INLINE_EMOJI_CLASS,
  FUN_STATIC_EMOJI_CLASS,
} from '../../components/fun/FunEmoji.dom.js';

export const matchEmojiImage: Matcher = (
  node,
  delta,
  _scroll,
  attributes
): Delta => {
  if (
    node.classList.contains(FUN_INLINE_EMOJI_CLASS) ||
    (node.classList.contains(FUN_STATIC_EMOJI_CLASS) &&
      node.dataset.emoji == null)
  ) {
    const value = node.getAttribute('aria-label');
    return new Delta().insert({ emoji: { value } }, attributes);
  }
  return delta;
};

export const matchEmojiBlot: Matcher = (
  node,
  delta,
  _scroll,
  attributes
): Delta => {
  if (
    node.classList.contains(FUN_STATIC_EMOJI_CLASS) &&
    node.dataset.emoji != null
  ) {
    const { emoji: value, source } = node.dataset;
    return new Delta().insert({ emoji: { value, source } }, attributes);
  }
  return delta;
};

export const matchEmojiText: Matcher = (
  node,
  _delta,
  _scroll,
  attributes
): Delta => {
  if (!('data' in node)) {
    return new Delta();
  }

  const { data } = node;
  if (!data || typeof data !== 'string') {
    return new Delta();
  }

  if (data.replace(/(\n|\r\n)/g, '') === '') {
    return new Delta();
  }

  const nodeAsInsert = { insert: data, attributes };

  return new Delta(insertEmojiOps([nodeAsInsert], attributes));
};
