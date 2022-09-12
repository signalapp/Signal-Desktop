import React from 'react';

import { createGlobalStyle } from 'styled-components';
import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS, THEMES } from './colors';

const whiteColor = '#ffffff';
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

// default to light theme
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
    --compositionContainerHeight: 60px;
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
    // TODO: this might be wrong text colour. Something happened during merge.
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

    /* New Theme Variables */
    /* Colors */
    --green-color: ${COLORS.PRIMARY.GREEN},
    --blue-color: ${COLORS.PRIMARY.BLUE},
    --yellow-color: ${COLORS.PRIMARY.YELLOW},
    --pink-color: ${COLORS.PRIMARY.PINK},
    --purple-color: ${COLORS.PRIMARY.PURPLE},
    --orange-color: ${COLORS.PRIMARY.ORANGE},
    --red-color: ${COLORS.PRIMARY.RED},
    /* TODO Theming this should be overridable */
    --primary-color: ${THEMES.CLASSIC_LIGHT.PRIMARY};
    --danger-color: ${COLORS.DANGER.LIGHT};

    /* Backgrounds */
    --background-primary-color: ${THEMES.CLASSIC_LIGHT.COLOR6};
    --background-secondary-color: ${THEMES.CLASSIC_LIGHT.COLOR5};

    /* Text */
    --text-primary-color: ${THEMES.CLASSIC_LIGHT.COLOR0};
    --text-secondary-color: ${THEMES.CLASSIC_LIGHT.COLOR1};

    /* Borders */
    --border-color: ${THEMES.CLASSIC_LIGHT.COLOR3};

    /* Modals */
    /* TODO Theming Clarify what those transparent colors mean */

    /* Text Box */
    --text-box-background-color: var(--background-primary-color);
    --text-box-text-control-color: ${THEMES.CLASSIC_LIGHT.COLOR1};
    --text-box-text-user-color: var(--text-primary-color);
    --text-box-border-color: ${THEMES.CLASSIC_LIGHT.COLOR2};

    /* Message Bubbles */
    --message-bubbles-outgoing-background-color: var(--primary-color);
    --message-bubbles-incoming-background-color: ${THEMES.CLASSIC_LIGHT.COLOR3};
    --message-bubbles-outgoing-text-color: var(--text-primary-color);
    --message-bubbles-incoming-text-color: var(--text-primary-color);

    /* Menu Button */
    --menu-button-background-color: ${THEMES.CLASSIC_LIGHT.COLOR0};
    /* TODO Theming Make a icon fill varible that uses the background color? */
    --menu-button-icon-color: ${THEMES.CLASSIC_LIGHT.COLOR6};

    /* Chat (Interaction) Buttons */
    --chat-buttons-background-color: ${THEMES.CLASSIC_LIGHT.COLOR4};
    --chat-buttons-background-hover-color: ${THEMES.CLASSIC_LIGHT.COLOR3};
    --chat-buttons-icon-color: var(--text-primary-color);

    /* Settings Tabs */
    --settings-tab-background-color: var(--background-primary-color);
    --settings-tab-background-hover-color: ${THEMES.CLASSIC_LIGHT.COLOR4};
    --settings-tab-background-selected-color: ${THEMES.CLASSIC_LIGHT.COLOR3};
    --settings-tab-text-color: var(--text-primary-color);

    /* TODO Theming probably consolidate this */
    /* Buttons */
    /* TODO Theming are solid buttons ever disabled? */
    /* Solid */
    --button-solid-background-color: var(--background-primary-color);
    --button-solid-background-hover-color: ${THEMES.CLASSIC_LIGHT.COLOR4};
    --button-solid-text-color: var(--text-primary-color);
    --button-solid-text-hover-color: var(--text-primary-color);

    /* Outline */
    --button-outline-background-color: ${COLORS.TRANSPARENT};
    --button-outline-background-hover-color: rgba(${hexColorToRGB(
      THEMES.CLASSIC_LIGHT.COLOR0
    )}, 0.1);
    --button-outline-text-color: var(--text-primary-color);
    /* TODO Theming we might not need this */
    --button-outline-text-hover-color: var(--text-primary-color);
    --button-outline-border-color: var(--text-primary-color);
    --button-outline-border-hover-color: var(--text-primary-color);
    --button-outline-disabled-color: var(--text-secondary-color);

    /* Icons */
    --button-icon-background-color: ${COLORS.TRANSPARENT};
    --button-icon-stroke-color: var(--text-secondary-color);
    --button-icon-stroke-hover-color: var(--text-primary-color);
    --button-icon-stroke-selected-color: var(--text-primary-color);

    /* TODO Theming Consolidate with code */
    /* Conversation Tab */
    /* This is also user for Overlay Tabs, Contact Rows, Convesation List Items etc. */
    --conversation-tab-background-color: ${THEMES.CLASSIC_LIGHT.COLOR5};
    --conversation-tab-background-hover-color: ${THEMES.CLASSIC_LIGHT.COLOR4};
    --conversation-tab-background-selected-color: ${THEMES.CLASSIC_LIGHT.COLOR4};
    --conversation-tab-background-unread-color: var(--background-primary-color);
    --conversation-tab-text-color: var(--text-secondary-color);
    --conversation-tab-text-selected-color: var(--text-primary-color);
    --conversation-tab-text-unread-color: var(--text-primary-color);
    --conversation-tab-text-secondary-color: var(--text-secondary-color);
    --conversation-tab-text-selected-color: var(--text-primary-color);
    --conversation-tab-bubble-background-color: ${THEMES.CLASSIC_LIGHT.COLOR3};
    --conversation-tab-bubble-text-color: var(--text-primary-color);
    /* TODO Theming account for overriding */
    --conversation-tab-color-strip-color: var(--primary-color);

    /* Search Bar */
    --search-bar-background-color: var(--background-secondary-color);
    --search-bar-text-control-color: var(--text-secondary-color);
    --search-bar-text-user-color: var(--text-primary-color);
    --search-bar-icon-color: var(--text-secondary-color);
    --search-bar-icon-hover-color: var(--text-primary-color);

    /* Scroll Bars */
    /* TODO Theming think this is the track? Should add thumb and other scroll colors here */
    /* Default */
    --scroll-bar-fill-color: var(--text-secondary-color);
    /* Zoom Bar */
    --zoom-bar-interval-color: var(--text-secondary-color);
    /* TODO Theming think this is the thumb? */
    --zoom-bar-selector-color: var(--primary-color);

    /* Toggle Switch */
    --toggle-switch-ball-color: ;
    /* TODO Theming think this should be white instead of transparent */
    --toggle-switch-off-background-color: ${COLORS.TRANSPARENT};
    --toggle-switch-off-border-color: var(--border-color);
    --toggle-switch-on-background-color: var(--primary-color);
    --toggle-switch-on-border-color: ${COLORS.TRANSPARENT};

    /* TODO Theming Think this is part of the Convesations Tab */
    /* Unread Messages Alert */
    --unread-messages-alert-background-color: var(--primary-color);
    --unread-messages-alert-text-color: var(--text-primary-color);

    /* toggles between the Light and Dark mode for a Theme */
    /* Color Mode Button */
    --button-color-mode-stroke-color: var(--text-secondary-color);
    --button-color-mode-hover-color: var(--text-primary-color);
    --button-color-mode-fill-color: ${COLORS.TRANSPARENT};

    /* Path Button */
    --button-path-default-color: ${COLORS.PATH.DEFAULT};
    --button-path-connecting-color: ${COLORS.PATH.CONNECTING};
    --button-path-error-color: ${COLORS.PATH.ERROR};

    /* Emoji Reaction Bar */
    --emoji-reaction-bar-background-color: ${THEMES.CLASSIC_LIGHT.COLOR4};
    /* NOTE only used for + icon */
    --emoji-reaction-bar-icon-background-color: var(--background-primary-color);
    --emoji-reaction-bar-icon-color: var(--text-primary-color);
  };
`;

export const SessionTheme = ({ children }: { children: any }) => (
  <>
    <SessionGlobalStyles />
    {children}
  </>
);

/**
 * Just putting those new theme values used in the settings to avoid having conflicts for now.
 *
 */

// TODO Theming need to improve this somehow
type SettingsThemeSwitcherColor = {
  background: string;
  border: string;
  sent: string;
  received: string;
};

export const OceanBlueDark: SettingsThemeSwitcherColor = {
  background: '#242735',
  border: '#3D4A5E',
  sent: '#57C9FA',
  received: '#3D4A5D',
};
export const OceanBlueLight: SettingsThemeSwitcherColor = {
  background: '#ECFAFB',
  border: '#5CAACC',
  sent: '#57C9FA',
  received: '#B3EDF2',
};

export type PrimaryColorIds = 'green' | 'blue' | 'yellow' | 'pink' | 'purple' | 'orange' | 'red';

type PrimaryColorType = { id: PrimaryColorIds; ariaLabel: string; color: string };

export const getPrimaryColors = (): Array<PrimaryColorType> => {
  return [
    { id: 'green', ariaLabel: window.i18n('primaryColorGreen'), color: COLORS.PRIMARY.GREEN },
    { id: 'blue', ariaLabel: window.i18n('primaryColorBlue'), color: COLORS.PRIMARY.BLUE },
    { id: 'yellow', ariaLabel: window.i18n('primaryColorYellow'), color: COLORS.PRIMARY.YELLOW },
    { id: 'pink', ariaLabel: window.i18n('primaryColorPink'), color: COLORS.PRIMARY.PINK },
    { id: 'purple', ariaLabel: window.i18n('primaryColorPurple'), color: COLORS.PRIMARY.PURPLE },
    { id: 'orange', ariaLabel: window.i18n('primaryColorOrange'), color: COLORS.PRIMARY.ORANGE },
    { id: 'red', ariaLabel: window.i18n('primaryColorRed'), color: COLORS.PRIMARY.RED },
  ];
};
