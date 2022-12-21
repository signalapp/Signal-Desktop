// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

async function applyTheme() {
  const theme = await window.SignalContext.Settings.themeSetting.getValue();
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

async function applyThemeLoop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await window.SignalContext.Settings.waitForChange();

    // eslint-disable-next-line no-await-in-loop
    await applyTheme();
  }
}

void applyTheme();
void applyThemeLoop();

window.SignalContext.nativeThemeListener.subscribe(() => {
  void applyTheme();
});
