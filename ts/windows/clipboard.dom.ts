// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { clipboard } from 'electron';

let doesClipboardNeedClearing = false;

function clearClipboard(): void {
  clipboard.clear('clipboard');

  // clipboard.clear is not reliable on Linux, so we actually have to overwrite it
  if (window.Signal.OS.isLinux()) {
    clipboard.writeText(' ');
  }

  doesClipboardNeedClearing = false;
}

function clearClipboardIfNeeded(): void {
  if (doesClipboardNeedClearing) {
    clearClipboard();
  }
}

function copyTextTemporarily(text: string, clearAfterMs: number): void {
  clipboard.writeText(text);
  doesClipboardNeedClearing = true;

  setTimeout(() => clearClipboard(), clearAfterMs);
}

window.SignalClipboard = {
  clearIfNeeded: clearClipboardIfNeeded,
  clear: clearClipboard,
  copyTextTemporarily,
};
