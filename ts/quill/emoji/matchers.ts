// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import type { AttributeMap } from '@signalapp/quill-cjs';

import { insertEmojiOps } from '../util';
import type { Matcher } from '../util';

export const matchEmojiImage: Matcher = (
  node: Element,
  delta: Delta,
  attributes: AttributeMap
): Delta => {
  if (
    node.classList.contains('emoji') ||
    node.classList.contains('module-emoji__image--16px')
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
  if (node.classList.contains('emoji-blot')) {
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
