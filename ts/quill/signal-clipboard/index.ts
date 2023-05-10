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

    const clipboard = this.quill.getModule('clipboard');
    // We don't want any of the default matchers!
    clipboard.matchers = clipboard.matchers.slice(11);
  }

  // TODO: do we need this anymore, given that we aren't using signal/html?
  onCapturePaste(event: ClipboardEvent): void {
    if (event.clipboardData == null) {
      return;
    }

    this.quill.focus();

    const clipboard = this.quill.getModule('clipboard');
    const selection = this.quill.getSelection();

    if (selection == null) {
      return;
    }

    const text = event.clipboardData.getData('text/plain');
    const html = event.clipboardData.getData('text/html');

    const clipboardDelta = html
      ? clipboard.convert(html)
      : clipboard.convert(replaceAngleBrackets(text));

    const { scrollTop } = this.quill.scrollingContainer;

    this.quill.selection.update('silent');

    if (selection) {
      setTimeout(() => {
        const delta = new Delta()
          .retain(selection.index)
          .concat(clipboardDelta);
        this.quill.updateContents(delta, 'user');
        this.quill.setSelection(delta.length(), 0, 'silent');
        this.quill.scrollingContainer.scrollTop = scrollTop;
      }, 1);
    }

    event.preventDefault();
  }
}
