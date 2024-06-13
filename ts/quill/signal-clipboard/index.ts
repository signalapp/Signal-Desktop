// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Quill from 'quill';
import Delta from 'quill-delta';

const prepareText = (text: string) => {
  const entities: Array<[RegExp, string]> = [
    [/&/g, '&amp;'],
    [/</g, '&lt;'],
    [/>/g, '&gt;'],
  ];

  const escapedEntities = entities.reduce(
    (acc, [re, replaceValue]) => acc.replace(re, replaceValue),
    text
  );

  return `<span>${escapedEntities}</span>`;
};

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

    const clipboard = this.quill.getModule('clipboard');
    const selection = this.quill.getSelection();
    const text = event.clipboardData.getData('text/plain');
    const signal = event.clipboardData.getData('text/signal');

    const clipboardContainsFiles = event.clipboardData.files?.length > 0;
    if (!clipboardContainsFiles) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (selection == null) {
      return;
    }

    if (!text && !signal) {
      return;
    }

    const clipboardDelta = signal
      ? clipboard.convert(signal)
      : clipboard.convert(prepareText(text));

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
