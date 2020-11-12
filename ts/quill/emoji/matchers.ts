// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Delta from 'quill-delta';
import { insertEmojiOps } from '../util';

export const matchEmojiImage = (node: Element): Delta => {
  if (node.classList.contains('emoji')) {
    const emoji = node.getAttribute('title');
    return new Delta().insert({ emoji });
  }
  return new Delta();
};

export const matchEmojiBlot = (node: HTMLElement, delta: Delta): Delta => {
  if (node.classList.contains('emoji-blot')) {
    const { emoji } = node.dataset;
    return new Delta().insert({ emoji });
  }
  return delta;
};

export const matchReactEmoji = (node: HTMLElement, delta: Delta): Delta => {
  if (node.classList.contains('module-emoji')) {
    const emoji = node.innerText.trim();
    return new Delta().insert({ emoji });
  }
  return delta;
};

export const matchEmojiText = (node: Text): Delta => {
  const nodeAsInsert = { insert: node.data };

  return new Delta(insertEmojiOps([nodeAsInsert]));
};
