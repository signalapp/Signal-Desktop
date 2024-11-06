// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SystemThemeType, ThemeType } from '../types/Util';
import { missingCaseError } from './missingCaseError';

export async function getThemeType(): Promise<ThemeType> {
  const themeSetting = await window.Events.getThemeSetting();

  if (themeSetting === 'light') {
    return ThemeType.light;
  }

  if (themeSetting === 'dark') {
    return ThemeType.dark;
  }

  if (themeSetting === 'system') {
    if (window.systemTheme === SystemThemeType.light) {
      return ThemeType.light;
    }
    if (window.systemTheme === SystemThemeType.dark) {
      return ThemeType.dark;
    }
    throw missingCaseError(window.systemTheme);
  }
  throw missingCaseError(themeSetting);
}
