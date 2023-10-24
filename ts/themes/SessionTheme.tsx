import { ipcRenderer } from 'electron';
import React from 'react';
import { createGlobalStyle } from 'styled-components';
import { switchThemeTo } from './switchTheme';
import { classicDark } from './classicDark';
import { getOppositeTheme, isThemeMismatched } from '../util/theme';
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
          dispatch: window?.inboxStore?.dispatch || undefined,
        });
        resolve(true); // Theme was switched
      } else {
        resolve(false); // Theme was not switched
      }
    });
  });
}
