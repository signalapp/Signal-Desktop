// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { missingCaseError } from './missingCaseError';
import { ThemeType } from '../types/Util';

export enum Theme {
  Light,
  Dark,
}

export function themeClassName(theme: Theme): string {
  switch (theme) {
    case Theme.Light:
      return 'light-theme';
    case Theme.Dark:
      return 'dark-theme';
    default:
      throw missingCaseError(theme);
  }
}

export function themeClassName2(theme: ThemeType): string {
  switch (theme) {
    case ThemeType.light:
      return 'light-theme';
    case ThemeType.dark:
      return 'dark-theme';
    default:
      throw missingCaseError(theme);
  }
}

export function getThemeByThemeType(theme: ThemeType): Theme {
  switch (theme) {
    case ThemeType.light:
      return Theme.Light;
    case ThemeType.dark:
      return Theme.Dark;
    default:
      throw missingCaseError(theme);
  }
}
