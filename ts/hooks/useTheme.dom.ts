// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect } from 'react';

import { ThemeType } from '../types/Util.std.js';

// Note that this hook is used in non-main windows (e.g. "About" and
// "Debug Log" windows), and thus can't access redux state.
export const useTheme = (): ThemeType => {
  const [theme, updateTheme] = useState(ThemeType.light);

  // Storybook support
  const { SignalContext } = window;

  useEffect(() => {
    const abortController = new AbortController();

    const { signal } = abortController;

    async function applyTheme() {
      let newTheme = await SignalContext.Settings.themeSetting.getValue();
      if (newTheme === 'system') {
        newTheme = SignalContext.nativeThemeListener.getSystemTheme();
      }

      if (signal.aborted) {
        return;
      }

      if (newTheme === 'dark') {
        updateTheme(ThemeType.dark);
      } else {
        updateTheme(ThemeType.light);
      }
    }

    async function loop() {
      while (!signal.aborted) {
        // eslint-disable-next-line no-await-in-loop
        await applyTheme();

        // eslint-disable-next-line no-await-in-loop
        await SignalContext.Settings.waitForChange();
      }
    }

    SignalContext.nativeThemeListener.subscribe(applyTheme);
    void loop();

    return () => {
      abortController.abort();
      SignalContext.nativeThemeListener.unsubscribe(applyTheme);
    };
  }, [updateTheme, SignalContext.Settings, SignalContext.nativeThemeListener]);

  return theme;
};
