// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSetting } from '../../ts/util/preload';
import { SignalContext } from '../../ts/windows/context';

const getThemeSetting = createSetting('themeSetting');

async function resolveTheme() {
  const theme = (await getThemeSetting.getValue()) || 'system';
  if (theme === 'system') {
    return SignalContext.nativeThemeListener.getSystemTheme();
  }
  return theme;
}

async function applyTheme() {
  window.document.body.classList.remove('dark-theme');
  window.document.body.classList.remove('light-theme');
  window.document.body.classList.add(`${await resolveTheme()}-theme`);
}

window.addEventListener('DOMContentLoaded', applyTheme);

SignalContext.nativeThemeListener.subscribe(() => applyTheme());
