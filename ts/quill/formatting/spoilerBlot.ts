// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import InlineBlot from '@signalapp/quill-cjs/blots/inline';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export class SpoilerBlot extends InlineBlot {
  static override blotName = 'spoiler';
  static override className = 'quill--spoiler';

  static override formats(): AnyRecord {
    return {
      spoiler: true,
    };
  }

  override optimize(context: AnyRecord): void {
    super.optimize(context);
    if (!this.domNode.classList.contains(this.statics.className)) {
      this.domNode.classList.add(this.statics.className);
    }
  }
}
