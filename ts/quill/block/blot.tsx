// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Quill from 'quill';

const Block = Quill.import('blots/block');

export class DirectionalBlot extends Block {
  static tagName = 'div';

  static create(value: string): Node {
    const node = super.create(value);
    node.setAttribute('dir', 'auto');
    return node;
  }
}
