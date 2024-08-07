import { ipcRenderer } from 'electron';

import { ReactNode } from 'react';
import useMount from 'react-use/lib/useMount';
import { SettingsKey } from '../data/settings-key';
import { getOppositeTheme, isThemeMismatched } from '../util/theme';
import { THEME_GLOBALS, setThemeValues } from './globals';
import { switchThemeTo } from './switchTheme';

export async function ensureThemeConsistency(): Promise<boolean> {
  const theme = window.Events.getThemeSetting();

  return new Promise(resolve => {
    ipcRenderer.send('get-native-theme');
    ipcRenderer.once('send-native-theme', (_, shouldUseDarkColors) => {
      const isMismatchedTheme = isThemeMismatched(theme, shouldUseDarkColors);
      if (isMismatchedTheme) {
        const newTheme = getOppositeTheme(theme);
        void switchThemeTo({
          theme: newTheme,
          mainWindow: true,
          usePrimaryColor: true,
          dispatch: window?.inboxStore?.dispatch,
        });
        resolve(true); // Theme was switched
      } else {
        resolve(false); // Theme was not switched
      }
    });
  });
}

const setupTheme = async () => {
  const shouldFollowSystemTheme = window.getSettingValue(SettingsKey.hasFollowSystemThemeEnabled);
  const theme = window.Events.getThemeSetting();
  const themeConfig = {
    theme,
    mainWindow: true,
    usePrimaryColor: true,
    dispatch: window?.inboxStore?.dispatch || undefined,
  };

  if (shouldFollowSystemTheme) {
    // Check if system theme matches currently set theme, if not switch it and return true, if matching return false
    const wasThemeSwitched = await ensureThemeConsistency();
    if (!wasThemeSwitched) {
      // if theme wasn't switched them set theme to default
      await switchThemeTo(themeConfig);
    }
  } else {
    await switchThemeTo(themeConfig);
  }
};

export const SessionTheme = ({ children }: { children: ReactNode }) => {
  useMount(() => {
    setThemeValues(THEME_GLOBALS);
    void setupTheme();
  });
  return children;
};
