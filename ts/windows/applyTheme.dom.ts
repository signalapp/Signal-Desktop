// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

async function applyTheme() {
  const themeSetting =
    await window.SignalContext.Settings.themeSetting.getValue();

  // oxlint-disable-next-line signal-desktop/enforce-class-name-has-styles
  document.body.classList.remove('light-theme');
  document.body.classList.remove('dark-theme');

  let theme: 'light' | 'dark';
  if (themeSetting === 'system') {
    theme = window.SignalContext.nativeThemeListener.getSystemTheme();
  } else {
    theme = themeSetting;
  }

  if (theme === 'light') {
    // oxlint-disable-next-line signal-desktop/enforce-class-name-has-styles
    document.body.classList.add('light-theme');
  } else if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  }
}

async function applyThemeLoop() {
  // oxlint-disable-next-line no-constant-condition
  while (true) {
    // oxlint-disable-next-line no-await-in-loop
    await window.SignalContext.Settings.waitForChange();

    // oxlint-disable-next-line no-await-in-loop
    await applyTheme();
  }
}

void applyTheme();
void applyThemeLoop();

window.SignalContext.nativeThemeListener.subscribe(() => {
  void applyTheme();
});

export {};
