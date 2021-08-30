import React from 'react';
// tslint:disable-next-line: no-import-side-effect no-submodule-imports
// import 'reset-css/reset.css';

import { DefaultTheme, ThemeProvider } from 'styled-components';

const white = '#ffffff';
const black = '#000000';
const warning = '#e7b100';
const destructive = '#ff453a';
const accentLightTheme = '#00e97b';
const accentDarkTheme = '#00f782';
const borderLightThemeColor = '#f1f1f1';
const borderDarkThemeColor = '#ffffff0F';

// const borderAvatarColor = '#00000059';
// const borderLightTheme = '#f1f1f1';
// const borderDarkTheme = '#ffffff0F';

const common = {
  fonts: {
    sessionFontDefault: 'Roboto',
    sessionFontAccent: 'Loor',
    sessionFontMono: 'SpaceMono',
    xs: '11px',
    sm: '13px',
    md: '15px',
    lg: '18px',
    xl: '24px',
  },
  margins: {
    xs: '5px',
    sm: '10px',
    md: '15px',
    lg: '20px',
  },
  animations: {
    defaultDuration: '0.25s',
  },
};

export const lightTheme: DefaultTheme = {
  common,
  colors: {
    accent: accentLightTheme,
    accentButton: black,
    warning: warning,
    destructive: destructive,
    // text
    textColor: black,
    textColorSubtle: `${black}99`,
    textColorOpposite: white,
    textAccent: '#00c769',
    // conversation view
    composeViewButtonBackground: '#efefef',
    sentMessageBackground: accentLightTheme,
    sentMessageText: white,
    sessionShadow: `0 0 4px 0 ${black}5E`,
    // left pane
    clickableHovered: '#dfdfdf',
    sessionBorder: `1px solid ${borderLightThemeColor}`,
    sessionBorderColor: borderLightThemeColor,
    recoveryPhraseBannerBackground: white,
    // pill divider:
    pillDividerColor: `${black}1A`,
    lastSeenIndicatorColor: '#62656a',
    lastSeenIndicatorTextColor: '#070c14',
    quoteBottomBarBackground: '#f0f0f0',
  },
};

export const darkTheme: DefaultTheme = {
  common,
  colors: {
    accent: accentDarkTheme,
    accentButton: accentDarkTheme,
    warning: warning,
    destructive: destructive,
    // text
    textColor: white,
    textColorSubtle: `${white}99`,
    textColorOpposite: black,
    textAccent: accentDarkTheme,
    // conversation view
    composeViewButtonBackground: '#232323',
    sentMessageBackground: accentDarkTheme,
    sentMessageText: black,
    sessionShadow: `0 0 4px 0 ${white}33`,
    // left pane
    clickableHovered: '#414347',
    sessionBorder: `1px solid ${borderDarkThemeColor}`,
    sessionBorderColor: borderDarkThemeColor,
    recoveryPhraseBannerBackground: '#1f1f1f',
    // pill divider:
    pillDividerColor: '#353535',
    lastSeenIndicatorColor: '#353535',
    lastSeenIndicatorTextColor: '#a8a9aa',
    quoteBottomBarBackground: '#404040',
  },
};

export const inversedTheme = (theme: DefaultTheme): DefaultTheme => {
  return {
    colors: {
      ...theme.colors,
      textColor: theme.colors.textColorOpposite,
      textColorOpposite: theme.colors.textColor,
    },
    common: theme.common,
  };
};

export const SessionTheme = ({ children, theme }: { children: any; theme: DefaultTheme }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
