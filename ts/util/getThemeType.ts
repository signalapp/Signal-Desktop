// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ThemeType } from '../types/Util';

export function getThemeType(): ThemeType {
  const themeSetting = window.Events.getThemeSetting();

  if (themeSetting === 'light') {
    return ThemeType.light;
  }

  if (themeSetting === 'dark') {
    return ThemeType.dark;
  }

  return window.systemTheme;
}
