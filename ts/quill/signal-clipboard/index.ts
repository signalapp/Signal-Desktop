// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Quill from 'quill';
import { getTextFromOps } from '../util';

const getSelectionHTML = () => {
  const selection = window.getSelection();

  if (selection === null) {
    return '';
  }

  const range = selection.getRangeAt(0);
  const contents = range.cloneContents();
  const div = document.createElement('div');

  div.appendChild(contents);

  return div.innerHTML;
};

export class SignalClipboard {
  quill: Quill;

  constructor(quill: Quill) {
    this.quill = quill;

    this.quill.root.addEventListener('copy', e => this.onCaptureCopy(e, false));
    this.quill.root.addEventListener('cut', e => this.onCaptureCopy(e, true));
  }

  onCaptureCopy(event: ClipboardEvent, isCut = false): void {
    event.preventDefault();

    if (event.clipboardData === null) {
      return;
    }

    const range = this.quill.getSelection();

    if (range === null) {
      return;
    }

    const contents = this.quill.getContents(range.index, range.length);

    if (contents === null) {
      return;
    }

    const { ops } = contents;

    if (ops === undefined) {
      return;
    }

    const text = getTextFromOps(ops);
    const html = getSelectionHTML();

    event.clipboardData.setData('text/plain', text);
    event.clipboardData.setData('text/html', html);

    if (isCut) {
      this.quill.deleteText(range.index, range.length, 'user');
    }
  }
}
