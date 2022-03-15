import React from 'react';

import { createGlobalStyle } from 'styled-components';

const white = '#ffffff';
const black = '#000000';
const warning = '#e7b100';
const destructive = '#ff453a';
const accentLightTheme = '#00e97b';
const accentDarkTheme = '#00f782';
const borderLightThemeColor = '#f1f1f1';
const borderDarkThemeColor = '#ffffff0F';

// DARK COLORS
const darkColorAccent = accentDarkTheme;
const darkColorAccentButton = accentDarkTheme;
const darkColorText = white;
const darkColorTextOpposite = black;

const darkColorTextSubtle = `${white}99`;
const darkColorTextAccent = accentDarkTheme;
const darkColorSessionShadow = `0 0 4px 0 ${white}33`;
const darkColorComposeViewBg = '#232323';
const darkColorSentMessageBg = accentDarkTheme;
const darkColorSentMessageText = black;
const darkColorClickableHovered = '#414347';
const darkColorSessionBorder = `1px solid ${borderDarkThemeColor}`;
const darkColorSessionBorderColor = borderDarkThemeColor;
const darkColorRecoveryPhraseBannerBg = '#1f1f1f';
const darkColorPillDivider = '#353535';
const darkColorLastSeenIndicator = accentDarkTheme;
const darkColorQuoteBottomBarBg = '#404040';
const darkColorCellBackground = '#1b1b1b';
const darkColorReceivedMessageBg = '#2d2d2d';
const darkColorReceivedMessageText = white;

const darkColorPillDividerText = '#a0a0a0';
const darkInputBackground = darkColorCellBackground;
const darkFilterSessionText = 'none';
const darkUnreadBorder = `4px solid ${accentDarkTheme}`;

const darkScrollbarThumb = '#474646';
const darkScrollbarTrack = '#1b1b1b';
const darkFakeChatBubbleBg = '#212121';

const darkInboxBackground = '#171717';
const darkLeftPaneOverlayBg = darkInboxBackground;
const darkConversationItemSelected = '#404040';
const darkConversationItemHasUnread = '#2c2c2c';
const darkConversationList = '#1b1b1b';

const darkTextHighlight = `${white}88`;
const darkForegroundPrimary = white;
const darkBackgroundPrimary = '#474646';
const darkButtonGreen = accentDarkTheme;
const darkModalBackground = '#101011';

const grey67 = '#434343';
const darkMessageRequestBannerBackground = darkConversationItemHasUnread;
const darkMessageRequestBannerIconBackground = grey67;
const darkMessageRequestBannerUnreadBackground = grey67;
const darkMessageRequestBannerIcon = '#adadad';

export const switchHtmlToDarkTheme = () => {
  document.documentElement.style.setProperty('--color-accent', darkColorAccent);
  document.documentElement.style.setProperty('--color-accent-button', darkColorAccentButton);
  document.documentElement.style.setProperty('--color-text', darkColorText);
  document.documentElement.style.setProperty('--color-text-menu-highlighted', lightColorText);
  document.documentElement.style.setProperty('--color-text-subtle', darkColorTextSubtle);
  document.documentElement.style.setProperty('--color-text-accent', darkColorTextAccent);
  document.documentElement.style.setProperty('--color-text-opposite', darkColorTextOpposite);
  document.documentElement.style.setProperty('--color-session-shadow', darkColorSessionShadow);
  document.documentElement.style.setProperty(
    '--color-compose-view-button-background',
    darkColorComposeViewBg
  );
  document.documentElement.style.setProperty(
    '--color-sent-message-background',
    darkColorSentMessageBg
  );
  document.documentElement.style.setProperty('--color-sent-message-text', darkColorSentMessageText);
  document.documentElement.style.setProperty(
    '--color-clickable-hovered',
    darkColorClickableHovered
  );
  document.documentElement.style.setProperty('--color-session-border', darkColorSessionBorder);
  document.documentElement.style.setProperty('--color-session-border', darkColorSessionBorderColor);
  document.documentElement.style.setProperty(
    '--color-recovery-phrase-banner-background',
    darkColorRecoveryPhraseBannerBg
  );
  document.documentElement.style.setProperty('--color-pill-divider', darkColorPillDivider);
  document.documentElement.style.setProperty(
    '--color-last-seen-indicator',
    darkColorLastSeenIndicator
  );
  document.documentElement.style.setProperty(
    '--color-quote-bottom-bar-background',
    darkColorQuoteBottomBarBg
  );
  document.documentElement.style.setProperty('--color-cell-background', darkColorCellBackground);
  document.documentElement.style.setProperty(
    '--color-received-message-text',
    darkColorReceivedMessageText
  );
  document.documentElement.style.setProperty(
    '--color-received-message-background',
    darkColorReceivedMessageBg
  );
  document.documentElement.style.setProperty('--color-pill-divider-text', darkColorPillDividerText);
  document.documentElement.style.setProperty('--color-input-background', darkInputBackground);

  document.documentElement.style.setProperty('--filter-session-text', darkFilterSessionText);
  document.documentElement.style.setProperty('--border-unread', darkUnreadBorder);

  document.documentElement.style.setProperty('--color-scroll-bar-thumb', darkScrollbarThumb);
  document.documentElement.style.setProperty('--color-scroll-bar-track', darkScrollbarTrack);
  document.documentElement.style.setProperty(
    '--color-fake-chat-bubble-background',
    darkFakeChatBubbleBg
  );
  document.documentElement.style.setProperty('--color-inbox-background', darkInboxBackground);
  document.documentElement.style.setProperty(
    '--color-left-pane-overlay-background',
    darkLeftPaneOverlayBg
  );
  document.documentElement.style.setProperty(
    '--color-conversation-item-selected',
    darkConversationItemSelected
  );
  document.documentElement.style.setProperty(
    '--color-conversation-item-has-unread',
    darkConversationItemHasUnread
  );
  document.documentElement.style.setProperty('--color-conversation-list', darkConversationList);

  document.documentElement.style.setProperty('--color-text-highlight', darkTextHighlight);
  document.documentElement.style.setProperty('--color-foreground-primary', darkForegroundPrimary);
  document.documentElement.style.setProperty('--color-background-primary', darkBackgroundPrimary);
  document.documentElement.style.setProperty('--color-button-green', darkButtonGreen);
  document.documentElement.style.setProperty('--color-modal-background', darkModalBackground);
  document.documentElement.style.setProperty('--border-session', darkColorSessionBorder);

  document.documentElement.style.setProperty(
    '--color-request-banner-background',
    darkMessageRequestBannerBackground
  );
  document.documentElement.style.setProperty(
    '--color-request-banner-icon-background',
    darkMessageRequestBannerIconBackground
  );
  document.documentElement.style.setProperty(
    '--color-request-banner-unread-background',
    darkMessageRequestBannerUnreadBackground
  );
  document.documentElement.style.setProperty(
    '--color-request-banner-icon',
    darkMessageRequestBannerIcon
  );
};

// LIGHT COLORS
const lightColorAccent = accentLightTheme;
const lightColorAccentButton = black;
const lightColorText = black;
const lightColorTextOpposite = white;
const lightColorTextSubtle = `${black}99`;
const lightColorTextAccent = accentLightTheme;
const lightColorSessionShadow = `0 0 4px 0 ${black}5E`;
const lightColorComposeViewBg = '#efefef';
const lightColorSentMessageBg = accentLightTheme;
const lightColorClickableHovered = '#dfdfdf';
const lightColorSessionBorderColor = borderLightThemeColor;
const lightColorSessionBorder = `1px solid ${lightColorSessionBorderColor}`;
const lightColorRecoveryPhraseBannerBg = white;
const lightColorPillDivider = `${black}1A`;
const lightColorLastSeenIndicator = black;
const lightColorQuoteBottomBarBg = '#f0f0f0';
const lightColorCellBackground = '#f9f9f9';
const lightColorReceivedMessageBg = '#f5f5f5';
const lightColorReceivedMessageText = black;

const lightColorPillDividerText = '#555555';

const lightInputBackground = '#efefef';
const lightFilterSessionText = 'brightness(0) saturate(100%)';
const lightUnreadBorder = `4px solid ${accentLightTheme}`;

const lightScrollbarThumb = '#474646';
const lightScrollbarTrack = '#fcfcfc';
const lightFakeChatBubbleBg = '#f5f5f5';

const lightInboxBackground = white;
const lightLeftPaneOverlayBg = lightInboxBackground;
const lightConversationItemSelected = '#f0f0f0';
const lightConversationItemHasUnread = '#fcfcfc';
const lightConversationList = '#f9f9f9';

const lightTextHighlight = `${black}88`;
const lightForegroundPrimary = white;
const lightBackgroundPrimary = '#272726';
const lightButtonGreen = '#272726';
const lightModalBackground = '#fcfcfc';

const lightMessageRequestBannerBackground = lightColorQuoteBottomBarBg;
const lightMessageRequestBannerIconBackground = '#585858';
const lightMessageRequestBannerUnreadBackground = lightColorClickableHovered;
const lightMessageRequestBannerIcon = white;

export const switchHtmlToLightTheme = () => {
  document.documentElement.style.setProperty('--color-accent', lightColorAccent);
  document.documentElement.style.setProperty('--color-accent-button', lightColorAccentButton);
  document.documentElement.style.setProperty('--color-text', lightColorText);
  document.documentElement.style.setProperty('--color-text-menu-highlighted', lightColorText);
  document.documentElement.style.setProperty('--color-text-subtle', lightColorTextSubtle);
  document.documentElement.style.setProperty('--color-text-accent', lightColorTextAccent);
  document.documentElement.style.setProperty('--color-text-opposite', lightColorTextOpposite);

  document.documentElement.style.setProperty('--color-session-shadow', lightColorSessionShadow);
  document.documentElement.style.setProperty(
    '--color-compose-view-button-background',
    lightColorComposeViewBg
  );
  document.documentElement.style.setProperty(
    '--color-sent-message-background',
    lightColorSentMessageBg
  );
  document.documentElement.style.setProperty('--color-sent-message-text', darkColorSentMessageText);
  document.documentElement.style.setProperty(
    '--color-clickable-hovered',
    lightColorClickableHovered
  );
  document.documentElement.style.setProperty('--color-session-border', lightColorSessionBorder);
  document.documentElement.style.setProperty(
    '--color-session-border',
    lightColorSessionBorderColor
  );
  document.documentElement.style.setProperty(
    '--color-recovery-phrase-banner-background',
    lightColorRecoveryPhraseBannerBg
  );
  document.documentElement.style.setProperty('--color-pill-divider', lightColorPillDivider);
  document.documentElement.style.setProperty(
    '--color-last-seen-indicator',
    lightColorLastSeenIndicator
  );
  document.documentElement.style.setProperty(
    '--color-quote-bottom-bar-background',
    lightColorQuoteBottomBarBg
  );
  document.documentElement.style.setProperty('--color-cell-background', lightColorCellBackground);
  document.documentElement.style.setProperty(
    '--color-received-message-text',
    lightColorReceivedMessageText
  );
  document.documentElement.style.setProperty(
    '--color-received-message-background',
    lightColorReceivedMessageBg
  );
  document.documentElement.style.setProperty(
    '--color-pill-divider-text',
    lightColorPillDividerText
  );
  document.documentElement.style.setProperty('--color-input-background', lightInputBackground);
  document.documentElement.style.setProperty('--filter-session-text', lightFilterSessionText);
  document.documentElement.style.setProperty('--border-unread', lightUnreadBorder);

  document.documentElement.style.setProperty('--color-scroll-bar-thumb', lightScrollbarThumb);
  document.documentElement.style.setProperty('--color-scroll-bar-track', lightScrollbarTrack);
  document.documentElement.style.setProperty(
    '--color-fake-chat-bubble-background',
    lightFakeChatBubbleBg
  );
  document.documentElement.style.setProperty('--color-inbox-background', lightInboxBackground);
  document.documentElement.style.setProperty(
    '--color-left-pane-overlay-background',
    lightLeftPaneOverlayBg
  );
  document.documentElement.style.setProperty(
    '--color-conversation-item-selected',
    lightConversationItemSelected
  );
  document.documentElement.style.setProperty(
    '--color-conversation-item-has-unread',
    lightConversationItemHasUnread
  );
  document.documentElement.style.setProperty('--color-conversation-list', lightConversationList);

  document.documentElement.style.setProperty('--color-text-highlight', lightTextHighlight);
  document.documentElement.style.setProperty('--color-foreground-primary', lightForegroundPrimary);
  document.documentElement.style.setProperty('--color-background-primary', lightBackgroundPrimary);
  document.documentElement.style.setProperty('--color-button-green', lightButtonGreen);
  document.documentElement.style.setProperty('--color-modal-background', lightModalBackground);
  document.documentElement.style.setProperty('--border-session', lightColorSessionBorder);
  document.documentElement.style.setProperty(
    '--color-request-banner-background',
    lightMessageRequestBannerBackground
  );
  document.documentElement.style.setProperty(
    '--color-request-banner-icon-background',
    lightMessageRequestBannerIconBackground
  );
  document.documentElement.style.setProperty(
    '--color-request-banner-unread-background',
    lightMessageRequestBannerUnreadBackground
  );
  document.documentElement.style.setProperty(
    '--color-request-banner-icon',
    lightMessageRequestBannerIcon
  );
};

// default to light theme
export const SessionGlobalStyles = createGlobalStyle`
  html {
    /* FONTS */
    --font-default:  'Roboto';
    --font-font-accent:  'Loor';
    --font-font-mono:  'SpaceMono';
    --font-size-xs:  11px;
    --font-size-sm:  13px;
    --font-size-md:  15px;

    /* MARGINS */
    --margins-xs:  5px;
    --margins-sm:  10px;
    --margins-md:  15px;
    --margins-lg:  20px;

    /* ANIMATIONS */
    --default-duration: '0.25s';
    /* FILTERS */
    --filter-session-text: ${lightFilterSessionText};
    /* BORDERS */
    --border-unread: ${lightUnreadBorder};
    --border-session:  ${lightColorSessionBorder};

    /* COLORS NOT CHANGING BETWEEN THEMES */
    --color-warning:  ${warning};
    --color-destructive:  ${destructive};
    /* COLORS */
    --color-accent: ${lightColorAccent};
    --color-accent-button:  ${lightColorAccentButton};

    --color-text:  ${lightColorText};
    --color-text-subtle:  ${lightColorTextSubtle};
    --color-text-accent:  ${lightColorTextAccent};
    --color-text-opposite:  ${lightColorTextOpposite};

    --color-session-shadow: ${lightColorSessionShadow};
    --color-compose-view-button-background: ${lightColorComposeViewBg};
    --color-sent-message-background:  ${lightColorSentMessageBg};
    --color-sent-message-text:  ${darkColorSentMessageText};
    --color-clickable-hovered: ${lightColorClickableHovered};
    --color-session-border:  ${lightColorSessionBorderColor};
    --color-recovery-phrase-banner-background: ${lightColorRecoveryPhraseBannerBg};
    --color-pill-divider:  ${lightColorPillDivider};
    --color-last-seen-indicator: ${lightColorLastSeenIndicator};
    --color-quote-bottom-bar-background:  ${lightColorQuoteBottomBarBg};
    --color-cell-background: ${lightColorCellBackground};
    --color-pill-divider-text:  ${lightColorPillDividerText};
    --color-input-background: ${lightInputBackground};
    --color-scroll-bar-thumb: ${lightScrollbarThumb};
    --color-scroll-bar-track: ${lightScrollbarTrack};
    --color-fake-chat-bubble-background: ${lightFakeChatBubbleBg};
    --color-inbox-background: ${lightInboxBackground};
    --color-left-pane-overlay-background: ${lightLeftPaneOverlayBg};
    --color-conversation-item-selected: ${lightConversationItemSelected};
    --color-conversation-item-has-unread: ${lightConversationItemHasUnread};
    --color-conversation-list: ${lightConversationList};
    --color-text-highlight: ${lightTextHighlight};
    --color-foreground-primary: ${lightForegroundPrimary};
    --color-background-primary: ${lightBackgroundPrimary};
    --color-button-green: ${lightButtonGreen};
    --color-modal-background: ${lightModalBackground};


  };
`;

export const SessionTheme = ({ children }: { children: any }) => (
  <>
    <SessionGlobalStyles />
    {children}
  </>
);
