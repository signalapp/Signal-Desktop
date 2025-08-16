// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import BlockBlot from '@signalapp/quill-cjs/blots/block';

export class DirectionalBlot extends BlockBlot {
  static override tagName = 'div';

  static override create(value: string): HTMLElement {
    const node = super.create(value);
    node.setAttribute('dir', 'auto');
    return node;
  }
}
