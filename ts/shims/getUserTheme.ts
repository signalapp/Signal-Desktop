// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThemeType } from '../types/Util.std.js';
import { getTheme } from '../state/selectors/user.std.js';

export function getUserTheme(): ThemeType {
  return getTheme(window.reduxStore.getState());
}
