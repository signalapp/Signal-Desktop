import React from 'react';

import { createGlobalStyle } from 'styled-components';
import { classicLight } from './classicLight';
import { declareCSSVariables, THEME_GLOBALS } from './globals';

export const whiteColor = '#ffffff';
const whiteColorRGB = '255, 255, 255'; // we need rgb values if we want css variables within rgba
const blackColor = '#000000';
const blackColorRGB = '0, 0, 0'; // we need rgb values if we want css variables within rgba
const warning = '#e7b100';
const destructive = '#ff453a';
const destructiveAltColor = '#ff4538';
const destructiveAltColorRGB = '255, 69, 56';
const accentLightTheme = '#00e97b';
const accentDarkTheme = '#00f782';
const borderLightThemeColor = '#f1f1f1';
const borderDarkThemeColor = '#ffffff0F';

// THEME INDEPEDENT COLORS
const sessionBlack = '#282829';
const avatarBorderColor = '#00000059';

// Blacks

// Blues
const lightBlueColor = '#a2d2f4';
const darkBlueColor = '#2090ea';

// Greens
const sessionGreenColor = accentDarkTheme;

// Grays
const grayColor = '#616161';
const grayColorRBG = '97, 97, 97';
const lightGrayColor = '#8b8e91';
const lighterGrayColor = '#e9e9e9';
const lightestGrayColor = '#f3f3f3';
const darkGrayColor = '#414347';
const darkGrayColorRGB = '65, 67, 71';
const darkerGrayColor = '#2f2f2f';
const darkestGrayColor = '#17191d';

// Transparent
const transparentColor = 'transparent';

// DARK COLORS
const darkColorAccent = accentDarkTheme;
const darkColorAccentRGB = '0, 247, 130';
const darkColorAccentButton = accentDarkTheme;
const darkColorText = whiteColor;
const darkColorTextRGB = whiteColorRGB;
const darkColorTextOpposite = blackColor;

const darkColorTextSubtle = `${whiteColor}99`;
const darkColorTextAccent = accentDarkTheme;
const darkColorSessionShadow = `0 0 4px 0 ${whiteColor}33`;
const darkColorComposeViewBg = '#232323';
export const darkColorSentMessageBg = accentDarkTheme;
const darkColorClickableHovered = '#414347';
const darkColorSessionBorder = `1px solid ${borderDarkThemeColor}`;
const darkColorSessionBorderColor = borderDarkThemeColor;
const darkColorRecoveryPhraseBannerBg = '#1f1f1f';
const darkColorPillDivider = 'var(--color-darker-gray-color)';
const darkColorLastSeenIndicator = accentDarkTheme;
const darkColorQuoteBottomBarBg = '#404040';
const darkColorCellBackground = '#1b1b1b';
export const darkColorReceivedMessageBg = '#2d2d2d';
const darkColorReceivedMessageText = whiteColor;

const darkColorPillDividerText = '#a0a0a0';
const darkInputBackground = darkColorCellBackground;
const darkFilterSessionText = 'none';
const darkUnreadBorder = `4px solid ${accentDarkTheme}`;

const darkScrollbarThumb = darkGrayColor;
const darkFakeChatBubbleBg = '#212121';

const darkInboxBackground = '#171717';
const darkLeftPaneOverlayBg = darkInboxBackground;
const darkConversationItemSelected = '#404040';
const darkConversationItemHasUnread = '#2c2c2c';
const darkConversationList = '#1b1b1b';

const darkTextHighlight = `${whiteColor}88`;
const darkForegroundPrimary = whiteColor;
const darkBackgroundPrimary = darkGrayColor;
const darkButtonGreen = accentDarkTheme;
const darkModalBackground = '#101011';

const grey67 = '#434343';
const darkMessageRequestBannerBackground = darkConversationItemHasUnread;
const darkMessageRequestBannerIconBackground = grey67;
const darkMessageRequestBannerUnreadBackground = grey67;
const darkMessageRequestBannerIcon = '#adadad';

export const switchHtmlToDarkTheme = () => {
  document.documentElement.style.setProperty('--color-accent', darkColorAccent);
  document.documentElement.style.setProperty('--color-accent-rgb', darkColorAccentRGB);
  document.documentElement.style.setProperty('--color-accent-button', darkColorAccentButton);
  document.documentElement.style.setProperty('--color-text', darkColorText);
  document.documentElement.style.setProperty('--color-text-rgb', darkColorTextRGB);
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
  document.documentElement.style.setProperty('--color-sent-message-text', sessionBlack);
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
const lightColorAccentRGB = '0, 233, 123';
const lightColorAccentButton = blackColor;
const lightColorText = blackColor;
const lightColorTextRGB = blackColorRGB;
const lightColorTextOpposite = whiteColor;
const lightColorTextSubtle = `${blackColor}99`;
const lightColorTextAccent = accentLightTheme;
const lightColorSessionShadow = `0 0 4px 0 ${blackColor}5E`;
const lightColorComposeViewBg = '#efefef';
export const lightColorSentMessageBg = accentLightTheme;
const lightColorClickableHovered = '#dfdfdf';
const lightColorSessionBorderColor = borderLightThemeColor;
const lightColorSessionBorder = `1px solid ${lightColorSessionBorderColor}`;
const lightColorRecoveryPhraseBannerBg = whiteColor;
const lightColorPillDivider = `${blackColor}1A`;
const lightColorLastSeenIndicator = blackColor;
const lightColorQuoteBottomBarBg = '#f0f0f0';
const lightColorCellBackground = '#f9f9f9';
export const lightColorReceivedMessageBg = '#f5f5f5';
const lightColorReceivedMessageText = blackColor;

const lightColorPillDividerText = '#555555';

const lightInputBackground = '#efefef';
const lightFilterSessionText = 'brightness(0) saturate(100%)';
const lightUnreadBorder = `4px solid ${accentLightTheme}`;

const lightScrollbarThumb = darkGrayColor;
const lightFakeChatBubbleBg = '#f5f5f5';

const lightInboxBackground = whiteColor;
const lightLeftPaneOverlayBg = lightInboxBackground;
const lightConversationItemSelected = '#f0f0f0';
const lightConversationItemHasUnread = '#fcfcfc';
const lightConversationList = '#f9f9f9';

const lightTextHighlight = `${blackColor}88`;
const lightForegroundPrimary = whiteColor;
const lightBackgroundPrimary = '#272726';
const lightButtonGreen = '#272726';
const lightModalBackground = '#fcfcfc';

const lightMessageRequestBannerBackground = lightColorQuoteBottomBarBg;
const lightMessageRequestBannerIconBackground = '#585858';
const lightMessageRequestBannerUnreadBackground = lightColorClickableHovered;
const lightMessageRequestBannerIcon = whiteColor;

export const switchHtmlToLightTheme = () => {
  document.documentElement.style.setProperty('--color-accent', lightColorAccent);
  document.documentElement.style.setProperty('--color-accent-rgb', lightColorAccentRGB);
  document.documentElement.style.setProperty('--color-accent-button', lightColorAccentButton);
  document.documentElement.style.setProperty('--color-text', lightColorText);
  document.documentElement.style.setProperty('--color-text-rgb', lightColorTextRGB);
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
  // TODO: This might be wrong. Didn't merge correctly.
  document.documentElement.style.setProperty('--color-sent-message-text', blackColor);
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

// default to classic light theme
export const SessionGlobalStyles = createGlobalStyle`
  html {
    /* Old Theme Variables */
    /* FONTS */
    --font-default:  'Roboto';
    --font-font-accent:  'Loor';
    --font-font-mono:  'SpaceMono';
    --font-size-xs: 11px;
    --font-size-sm: 13px;
    --font-size-md: 15px;
    --font-size-lg: 17px;
    --font-size-h1: 30px;
    --font-size-h2: 24px;
    --font-size-h3: 20px;
    --font-size-h4: 16px;

    /* MARGINS */
    --margins-xs:  5px;
    --margins-sm:  10px;
    --margins-md:  15px;
    --margins-lg:  20px;

    /* PADDING */
     // TODO Theming - review and update after Audric has done link preview fix
    --padding-message-content: 7px 13px;
    --padding-link-preview: -7px -13px 7px -13px; // bottom has positive value because a link preview has always a body below
    --border-radius-message-box: 16px;

    /* SIZES */
    --main-view-header-height: 63px;

    /* ANIMATIONS */
    --default-duration: 0.25s;

    /* FILTERS */
    --filter-session-text: ${lightFilterSessionText};

    /* BORDERS */
    --border-unread: ${lightUnreadBorder};
    --border-session:  ${lightColorSessionBorder};

    /* CONSTANTS */
    --composition-container-height: 60px;
    --search-input-height: 34px;

    /* COLORS NOT CHANGING BETWEEN THEMES */
    --color-black-color: ${blackColor};
    --color-black-color-rgb: ${blackColorRGB};
    --color-light-black-color: ${`rgba(${blackColorRGB}, 0.2)`};
    --color-lighter-black-color: ${`rgba(${blackColorRGB}, 0.15)`};
    --color-darkest-black-color: ${`rgba(${blackColorRGB}, 0.6)`};
    --color-session-green-color: ${sessionGreenColor};

    --color-white-color: ${whiteColor};
    --color-white-color-rgb: ${whiteColorRGB};
    --color-lighter-white-color: ${`rgba(${whiteColorRGB}, 0.15)`};
    --color-darkest-white-color: ${`rgba(${whiteColorRGB}, 0.85)`};

    --color-gray-color: ${grayColor};
    --color-gray-color-rgb: ${grayColorRBG};
    --color-light-gray-color: ${lightGrayColor};
    --color-lighter-gray-color: ${lighterGrayColor};
    --color-lightest-gray-color: ${lightestGrayColor};
    --color-dark-gray-color: ${darkGrayColor};
    --color-dark-gray-color-rgb: ${darkGrayColorRGB};
    --color-darker-gray-color: ${darkerGrayColor};
    --color-darkest-gray-color: ${darkestGrayColor};
    --color-light-blue-color: ${lightBlueColor};
    --color-dark-blue-color: ${darkBlueColor};
    --color-transparent-color: ${transparentColor};

    --color-warning:  ${warning};
    --color-destructive:  ${destructive};
    --color-destructive-alt:  ${destructiveAltColor};
    --color-destructive-alt-rgb: ${destructiveAltColorRGB};
    /* COLORS */
    --color-accent: ${lightColorAccent};
    --color-accent-rgb: ${lightColorAccentRGB};
    --color-accent-button:  ${lightColorAccentButton};

    --color-text:  ${lightColorText};
    --color-text-rgb:  ${lightColorTextRGB};
    --color-text-subtle:  ${lightColorTextSubtle};
    --color-text-accent:  ${lightColorTextAccent};
    --color-text-opposite:  ${lightColorTextOpposite};

    --color-session-shadow: ${lightColorSessionShadow};
    --color-compose-view-button-background: ${lightColorComposeViewBg};
    --color-sent-message-background:  ${lightColorSentMessageBg};
    --color-sent-message-text:  ${blackColor};
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
    --color-avatar-border-color: ${avatarBorderColor};

    /* New Theme */
    ${declareCSSVariables(THEME_GLOBALS)}
    ${declareCSSVariables(classicLight)}
  };
`;

export const SessionTheme = ({ children }: { children: any }) => (
  <>
    <SessionGlobalStyles />
    {children}
  </>
);
