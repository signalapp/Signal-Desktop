import React from 'react';
// tslint:disable-next-line: no-import-side-effect no-submodule-imports
// import 'reset-css/reset.css';

import { DefaultTheme, ThemeProvider } from 'styled-components';

const white = '#ffffff';
const black = '#000000';
const destructive = '#ff453a';
const accentLightTheme = '#00e97b';
const accentDarkTheme = '#00f782';
const borderLightTheme = '#f1f1f1';
const borderDarkTheme = '#ffffff0F';
const borderAvatarColor = '#00000059';

const common = {
  fonts: {
    sessionFontDefault: 'Public Sans',
    sessionFontAccent: 'Loor',
    sessionFontMono: 'SpaceMono',
  },
  margins: {
    xs: '5px',
    sm: '10px',
  },
};

export const lightTheme: DefaultTheme = {
  common,
  colors: {
    accent: accentLightTheme,
    accentButton: black,
    destructive: destructive,
    cellBackground: '#fcfcfc',
    modalBackground: '#fcfcfc',
    fakeChatBubbleBackground: '#f5f5f5',
    // input
    inputBackground: '#8E8E93331F',
    // text
    textColor: black,
    textColorSubtle: '#a0a0a0',
    textColorOpposite: white,
    textHighlight: `${black}33`,
    // inbox
    inboxBackground: white,
    // buttons
    backgroundPrimary: '#272726',
    foregroundPrimary: white,
    buttonGreen: '#272726',
    // conversation view
    composeViewBackground: '#fcfcfc',
    composeViewTextFieldBackground: '#ededed',
    receivedMessageBackground: '#f5f5f5',
    sentMessageBackground: accentLightTheme,
    receivedMessageText: black,
    sentMessageText: black,
    sessionShadow: `0 0 4px 0 ${black}5E`,
    sessionShadowColor: `${black}5E`,
    // left pane
    conversationList: white,
    conversationItemHasUnread: '#fcfcfc',
    conversationItemSelected: '#f0f0f0',
    clickableHovered: '#dfdfdf',
    sessionBorder: `1px solid ${borderLightTheme}`,
    sessionUnreadBorder: `4px solid ${accentLightTheme}`,
    leftpaneOverlayBackground: white,
    // scrollbars
    scrollBarTrack: '#fcfcfc',
    scrollBarThumb: '#474646',
    // pill divider:
    pillDividerColor: `${black}1A`,
    pillDividerTextColor: '#555555',
    // context menu
    contextMenuBackground: '#f5f5f5',
    filterSessionText: 'brightness(0) saturate(100%)',
    lastSeenIndicatorColor: '#62656a',
    lastSeenIndicatorTextColor: '#070c14',
    quoteBottomBarBackground: '#f0f0f0',
  },
};

export const darkTheme = {
  common,
  colors: {
    accent: accentDarkTheme,
    accentButton: accentDarkTheme,
    destructive: destructive,
    cellBackground: '#1b1b1b',
    modalBackground: '#101011',
    fakeChatBubbleBackground: '#212121',
    // input
    inputBackground: '#8e8e931F',
    // text
    textColor: white,
    textColorSubtle: '#a0a0a0',
    textColorOpposite: black,
    textHighlight: `${accentDarkTheme}99`,
    // inbox
    inboxBackground: 'linear-gradient(180deg, #171717 0%, #121212 100%)',
    // buttons
    backgroundPrimary: '#474646',
    foregroundPrimary: white,
    buttonGreen: accentDarkTheme,
    // conversation view
    composeViewBackground: '#1b1b1b',
    composeViewTextFieldBackground: '#141414',
    receivedMessageBackground: '#222325',
    sentMessageBackground: '#3f4146',
    receivedMessageText: white,
    sentMessageText: white,
    sessionShadow: `0 0 4px 0 ${white}33`,
    sessionShadowColor: `${white}33`,
    // left pane
    conversationList: '#1b1b1b',
    conversationItemHasUnread: '#2c2c2c',
    conversationItemSelected: '#404040',
    clickableHovered: '#414347',
    sessionBorder: `1px solid ${borderDarkTheme}`,
    sessionUnreadBorder: `4px solid ${accentDarkTheme}`,
    leftpaneOverlayBackground:
      'linear-gradient(180deg, #171717 0%, #121212 100%)',
    // scrollbars
    scrollBarTrack: '#1b1b1b',
    scrollBarThumb: '#474646',
    // pill divider:
    pillDividerColor: '#353535',
    pillDividerTextColor: '#a0a0a0',
    // context menu
    contextMenuBackground: '#212121',
    filterSessionText: 'none',
    lastSeenIndicatorColor: '#353535',
    lastSeenIndicatorTextColor: '#a8a9aa',
    quoteBottomBarBackground: '#404040',
  },
};

export const SessionTheme = ({
  children,
  theme,
}: {
  children: any;
  theme: DefaultTheme;
}) => <ThemeProvider theme={theme}>{children}</ThemeProvider>;
