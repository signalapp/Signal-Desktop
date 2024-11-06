// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SystemThemeType, ThemeType } from '../types/Util';

export async function getThemeType(): Promise<ThemeType> {
  const themeSetting = await window.Events.getThemeSetting();

  if (
    themeSetting === 'light' ||
    window.systemTheme === SystemThemeType.light
  ) {
    return ThemeType.light;
  }

  if (themeSetting === 'dark' || window.systemTheme === SystemThemeType.dark) {
    return ThemeType.dark;
  }

  return window.systemTheme;
}
