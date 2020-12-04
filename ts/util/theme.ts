// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { missingCaseError } from './missingCaseError';

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
