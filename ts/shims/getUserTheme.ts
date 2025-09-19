// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThemeType } from '../types/Util.js';
import { getTheme } from '../state/selectors/user.js';

export function getUserTheme(): ThemeType {
  return getTheme(window.reduxStore.getState());
}
