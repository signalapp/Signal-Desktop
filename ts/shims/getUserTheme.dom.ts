// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThemeType } from '../types/Util.std.ts';
import { getTheme } from '../state/selectors/user.std.ts';

export function getUserTheme(): ThemeType {
  return getTheme(window.reduxStore.getState());
}
