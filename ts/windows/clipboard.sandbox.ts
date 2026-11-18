// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

export type SignalClipboardType = Readonly<{
  clearIfNeeded: () => void;
  clear: () => void;
  copyTextTemporarily: (text: string, clearAfterMs: number) => void;
}>;

const SignalClipboard: SignalClipboardType = {
  clearIfNeeded() {
    ipcRenderer.send('SignalClipboard.clearIfNeeded');
  },
  clear() {
    ipcRenderer.send('SignalClipboard.clear');
  },
  copyTextTemporarily(text, clearAfterMs) {
    ipcRenderer.send('SignalClipboard.copyTextTemporarily', text, clearAfterMs);
  },
};

window.SignalClipboard = SignalClipboard;
