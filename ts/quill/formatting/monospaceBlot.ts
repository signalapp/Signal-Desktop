// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Parchment from 'parchment';
import Quill from 'quill';

const Inline: typeof Parchment.Inline = Quill.import('blots/inline');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export class MonospaceBlot extends Inline {
  static override formats(): boolean {
    return true;
  }

  override optimize(context: AnyRecord): void {
    super.optimize(context);
    if (!this.domNode.classList.contains(this.statics.className)) {
      this.domNode.classList.add(this.statics.className);
    }
  }
}

MonospaceBlot.blotName = 'monospace';
MonospaceBlot.className = 'quill--monospace';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore See this workaround: https://github.com/quilljs/quill/issues/2312#issuecomment-1097922620
Inline.order.splice(Inline.order.indexOf('bold'), 0, MonospaceBlot.blotName);
