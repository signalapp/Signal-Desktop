// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Delta from 'quill-delta';
import { insertEmojiOps } from '../util';

export const matchEmojiImage = (node: Element, delta: Delta): Delta => {
  if (
    node.classList.contains('emoji') ||
    node.classList.contains('module-emoji__image--16px')
  ) {
    const emoji = node.getAttribute('aria-label');
    return new Delta().insert({ emoji });
  }
  return delta;
};

export const matchEmojiBlot = (node: HTMLElement, delta: Delta): Delta => {
  if (node.classList.contains('emoji-blot')) {
    const { emoji } = node.dataset;
    return new Delta().insert({ emoji });
  }
  return delta;
};

export const matchEmojiText = (node: Text): Delta => {
  if (node.data.replace(/(\n|\r\n)/g, '') === '') {
    return new Delta();
  }

  const nodeAsInsert = { insert: node.data };

  return new Delta(insertEmojiOps([nodeAsInsert]));
};
