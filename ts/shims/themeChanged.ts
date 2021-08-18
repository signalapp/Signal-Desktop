// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function themeChanged(): void {
  if (window.reduxActions && window.reduxActions.user) {
    const theme = window.Events.getThemeSetting();
    window.reduxActions.user.userChanged({
      theme: theme === 'system' ? window.systemTheme : theme,
    });
  }
}
