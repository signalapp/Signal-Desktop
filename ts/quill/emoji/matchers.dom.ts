// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';

import { insertEmojiOps } from '../util.dom.js';
import type { Matcher } from '../util.dom.js';
import { getFunEmojiElementValue } from '../../components/fun/FunEmoji.dom.js';

export const matchEmojiBlot: Matcher = (
  node,
  delta,
  _scroll,
  attributes
): Delta => {
  const value = getFunEmojiElementValue(node);
  if (value != null) {
    const { source } = node.dataset;
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
