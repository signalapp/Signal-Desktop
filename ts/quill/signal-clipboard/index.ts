// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Quill from 'quill';
import Delta from 'quill-delta';

const replaceAngleBrackets = (text: string) => {
  const entities: Array<[RegExp, string]> = [
    [/&/g, '&amp;'],
    [/</g, '&lt;'],
    [/>/g, '&gt;'],
  ];

  return entities.reduce(
    (acc, [re, replaceValue]) => acc.replace(re, replaceValue),
    text
  );
};

export class SignalClipboard {
  quill: Quill;

  constructor(quill: Quill) {
    this.quill = quill;

    this.quill.root.addEventListener('paste', e => this.onCapturePaste(e));
  }

  onCapturePaste(event: ClipboardEvent): void {
    if (event.clipboardData == null) {
      return;
    }

    const clipboard = this.quill.getModule('clipboard');
    const selection = this.quill.getSelection();

    if (selection == null) {
      return;
    }

    const text = event.clipboardData.getData('text/plain');
    const signal = event.clipboardData.getData('text/signal');

    if (!text && !signal) {
      return;
    }

    const clipboardContainsFiles = event.clipboardData.files?.length > 0;
    if (!clipboardContainsFiles) {
      event.preventDefault();
      event.stopPropagation();
    }

    const clipboardDelta = signal
      ? clipboard.convert(signal)
      : clipboard.convert(replaceAngleBrackets(text));

    const { scrollTop } = this.quill.scrollingContainer;

    this.quill.selection.update('silent');

    if (selection) {
      setTimeout(() => {
        const delta = new Delta()
          .retain(selection.index)
          .delete(selection.length)
          .concat(clipboardDelta);
        this.quill.updateContents(delta, 'user');
        this.quill.setSelection(delta.length() - selection.length, 0, 'silent');
        this.quill.scrollingContainer.scrollTop = scrollTop;

        this.quill.focus();
      }, 1);
    }
  }
}
