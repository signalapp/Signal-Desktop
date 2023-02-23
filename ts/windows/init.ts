// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

document.body.classList.add(window.SignalContext.OS.getClassName());
if (window.SignalContext.OS.hasCustomTitleBar()) {
  document.body.classList.add('os-has-custom-titlebar');
}

if (window.SignalContext.renderWindow) {
  window.SignalContext.renderWindow();
} else {
  window.SignalContext.log.error('renderWindow is undefined!');
}
