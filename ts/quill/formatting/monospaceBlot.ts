// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import InlineBlot from '@signalapp/quill-cjs/blots/inline';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export class MonospaceBlot extends InlineBlot {
  static override blotName = 'monospace';
  static override className = 'quill--monospace';

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
