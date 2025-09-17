// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../util/assert.js';
import { getThemeType } from '../util/getThemeType.js';

import type { MenuOptionsType } from '../types/menu.js';
import type { MainWindowStatsType } from '../windows/context.js';
import type { ThemeType } from '../types/Util.js';

let mainWindowStats: MainWindowStatsType | undefined;
let menuOptions: MenuOptionsType | undefined;
let theme: ThemeType | undefined;

export async function loadUserData(): Promise<void> {
  await Promise.all([
    (async () => {
      mainWindowStats = await window.SignalContext.getMainWindowStats();
    })(),
    (async () => {
      menuOptions = await window.SignalContext.getMenuOptions();
    })(),
    (async () => {
      theme = await getThemeType();
    })(),
  ]);
}

export function getUserDataForRedux(): {
  mainWindowStats: MainWindowStatsType;
  menuOptions: MenuOptionsType;
  theme: ThemeType;
} {
  strictAssert(
    mainWindowStats != null && menuOptions != null && theme != null,
    'user data has not been loaded'
  );
  return { mainWindowStats, menuOptions, theme };
}
