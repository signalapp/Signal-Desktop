// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

document.body.classList.add(window.SignalContext.OS.getClassName());

if (window.SignalContext.renderWindow) {
  window.SignalContext.renderWindow();
} else {
  throw new Error('renderWindow is undefined!');
}
