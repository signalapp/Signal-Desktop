// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

if (window.SignalContext.renderWindow) {
  window.SignalContext.renderWindow();
} else {
  window.SignalContext.log.error('renderWindow is undefined!');
}
