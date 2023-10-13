import { ipcRenderer } from 'electron';
import React from 'react';
import { createGlobalStyle } from 'styled-components';
import { switchThemeTo } from './switchTheme';
import { ThemeStateType } from './constants/colors';
import { classicDark } from './classicDark';
import { declareCSSVariables, THEME_GLOBALS } from './globals';

// Defaults to Classic Dark theme
const SessionGlobalStyles = createGlobalStyle`
  html {
    ${declareCSSVariables(THEME_GLOBALS)}
    ${declareCSSVariables(classicDark)}
  };
`;

export const SessionTheme = ({ children }: { children: any }) => (
  <>
    <SessionGlobalStyles />
    {children}
  </>
);

export function getOppositeTheme(themeName: string) {
  if (themeName.includes('dark')) {
    return themeName.replace('dark', 'light');
  }
  if (themeName.includes('light')) {
    return themeName.replace('light', 'dark');
  }
  // If neither 'dark' nor 'light' is in the theme name, return the original theme name.
  return themeName;
}

export async function checkThemeCongruency(): Promise<boolean> {
  const theme = window.Events.getThemeSetting();

  return new Promise(resolve => {
    ipcRenderer.send('get-native-theme');
    ipcRenderer.once('send-native-theme', (_, shouldUseDarkColors) => {
      const isMismatchedTheme =
        (shouldUseDarkColors && theme.includes('light')) ||
        (!shouldUseDarkColors && theme.includes('dark'));
      if (isMismatchedTheme) {
        const newTheme = getOppositeTheme(theme) as ThemeStateType;
        void switchThemeTo({
          theme: newTheme,
          mainWindow: true,
          usePrimaryColor: true,
          dispatch: window?.inboxStore?.dispatch || undefined,
        });
        resolve(true); // Theme was switched
      } else {
        resolve(false); // Theme was not switched
      }
    });
  });
}
