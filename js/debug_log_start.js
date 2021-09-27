// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global $: false */

$(document).on('keydown', e => {
  if (e.keyCode === 27) {
    window.closeDebugLog();
  }
});

const $body = $(document.body);

async function applyTheme() {
  const theme = await window.themeSetting.getValue();
  document.body.classList.remove('light-theme');
  document.body.classList.remove('dark-theme');
  document.body.classList.add(
    `${
      theme === 'system'
        ? window.SignalContext.nativeThemeListener.getSystemTheme()
        : theme
    }-theme`
  );
}

applyTheme();

window.SignalContext.nativeThemeListener.subscribe(() => {
  applyTheme();
});

// got.js appears to need this to successfully submit debug logs to the cloud
window.setImmediate = window.nodeSetImmediate;

window.view = new window.Whisper.DebugLogView();
window.view.$el.appendTo($body);
