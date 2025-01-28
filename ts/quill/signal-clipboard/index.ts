// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Quill from '@signalapp/quill-cjs';
import { Delta } from '@signalapp/quill-cjs';
import { FormattingMenu, QuillFormattingStyle } from '../formatting/menu';
import { insertEmojiOps } from '../util';

type ClipboardOptions = Readonly<{
  isDisabled: boolean;
}>;

export class SignalClipboard {
  quill: Quill;
  options: ClipboardOptions;

  constructor(quill: Quill, options: ClipboardOptions) {
    this.quill = quill;
    this.options = options;

    this.quill.root.addEventListener('paste', e => this.onCapturePaste(e));
  }

  updateOptions(options: Partial<ClipboardOptions>): void {
    this.options = { ...this.options, ...options };
  }

  onCapturePaste(event: ClipboardEvent): void {
    if (this.options.isDisabled) {
      return;
    }

    if (event.clipboardData == null) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    const { clipboard } = this.quill;
    const selection = this.quill.getSelection();
    const text = event.clipboardData.getData('text/plain');
    const signal = event.clipboardData.getData('text/signal');

    const clipboardContainsFiles = event.clipboardData.files?.length > 0;

    if (clipboardContainsFiles) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (selection == null) {
      return;
    }

    if (!text && !signal) {
      return;
    }

    const { ops } = this.quill.getContents(selection.index, selection.length);
    // Only enable formatting on the pasted text if the entire selection has it enabled!
    const formats =
      selection.length === 0
        ? this.quill.getFormat(selection.index)
        : {
            [QuillFormattingStyle.bold]: FormattingMenu.isStyleEnabledForOps(
              ops,
              QuillFormattingStyle.bold
            ),
            [QuillFormattingStyle.italic]: FormattingMenu.isStyleEnabledForOps(
              ops,
              QuillFormattingStyle.italic
            ),
            [QuillFormattingStyle.monospace]:
              FormattingMenu.isStyleEnabledForOps(
                ops,
                QuillFormattingStyle.monospace
              ),
            [QuillFormattingStyle.spoiler]: FormattingMenu.isStyleEnabledForOps(
              ops,
              QuillFormattingStyle.spoiler
            ),
            [QuillFormattingStyle.strike]: FormattingMenu.isStyleEnabledForOps(
              ops,
              QuillFormattingStyle.strike
            ),
          };
    const clipboardDelta = signal
      ? clipboard.convert({ html: signal }, formats)
      : new Delta(insertEmojiOps(clipboard.convert({ text }, formats).ops, {}));

    this.quill.selection.update('silent');

    if (selection) {
      setTimeout(() => {
        const delta = new Delta()
          .retain(selection.index)
          .delete(selection.length)
          .concat(clipboardDelta);
        this.quill.updateContents(delta, 'user');
        this.quill.setSelection(delta.length() - selection.length, 0, 'silent');
        this.quill.scrollSelectionIntoView();

        this.quill.focus();
      }, 1);
    }
  }
}
