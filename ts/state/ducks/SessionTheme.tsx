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
const darkColorLastSeenIndicator = '#353535';
const darkColorLastSeenIndicatorText = '#a8a9aa';
const darkColorQuoteBottomBarBg = '#404040';

export const switchHtmlToDarkTheme = () => {
  document.documentElement.style.setProperty('--color-accent', darkColorAccent);
  document.documentElement.style.setProperty('--color-accent-button', darkColorAccentButton);
  document.documentElement.style.setProperty('--color-text', darkColorText);
  document.documentElement.style.setProperty('--color-text-subtle', darkColorTextSubtle);
  document.documentElement.style.setProperty('--color-text-accent', darkColorTextAccent);
  document.documentElement.style.setProperty('--color-session-shadow', darkColorSessionShadow);
  document.documentElement.style.setProperty(
    '--color-compose-view-background',
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
  document.documentElement.style.setProperty(
    '--color-session-border-color',
    darkColorSessionBorderColor
  );
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
    '--color-last-seen-indicator-text',
    darkColorLastSeenIndicatorText
  );
  document.documentElement.style.setProperty(
    '--color-quote-bottom-bar-background',
    darkColorQuoteBottomBarBg
  );
};

// LIGHT COLORS
const lightColorAccent = accentLightTheme;
const lightColorAccentButton = black;
const lightColorText = black;
const lightColorTextSubtle = `${black}99`;
const lightColorTextAccent = '#00c769';
const lightColorSessionShadow = `0 0 4px 0 ${black}5E`;
const lightColorComposeViewBg = '#efefef';
const lightColorSentMessageBg = accentLightTheme;
const lightColorSentMessageText = white;
const lightColorClickableHovered = '#dfdfdf';
const lightColorSessionBorder = `1px solid ${borderLightThemeColor}`;
const lightColorSessionBorderColor = borderLightThemeColor;
const lightColorRecoveryPhraseBannerBg = white;
const lightColorPillDivider = `${black}1A`;
const lightColorLastSeenIndicator = '#62656a';
const lightColorLastSeenIndicatorText = '#070c14';
const lightColorQuoteBottomBarBg = '#f0f0f0';

export const switchHtmlToLightTheme = () => {
  document.documentElement.style.setProperty('--color-accent', lightColorAccent);
  document.documentElement.style.setProperty('--color-accent-button', lightColorAccentButton);
  document.documentElement.style.setProperty('--color-text', lightColorText);
  document.documentElement.style.setProperty('--color-text-subtle', lightColorTextSubtle);
  document.documentElement.style.setProperty('--color-text-accent', lightColorTextAccent);
  document.documentElement.style.setProperty('--color-session-shadow', lightColorSessionShadow);
  document.documentElement.style.setProperty(
    '--color-compose-view-background',
    lightColorComposeViewBg
  );
  document.documentElement.style.setProperty(
    '--color-sent-message-background',
    lightColorSentMessageBg
  );
  document.documentElement.style.setProperty(
    '--color-sent-message-text',
    lightColorSentMessageText
  );
  document.documentElement.style.setProperty(
    '--color-clickable-hovered',
    lightColorClickableHovered
  );
  document.documentElement.style.setProperty('--color-session-border', lightColorSessionBorder);
  document.documentElement.style.setProperty(
    '--color-session-border-color',
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
    '--color-last-seen-indicator-text',
    lightColorLastSeenIndicatorText
  );
  document.documentElement.style.setProperty(
    '--color-quote-bottom-bar-background',
    lightColorQuoteBottomBarBg
  );
};

// default to dark theme
export const SessionGlobalStyles = createGlobalStyle`
  html {
    /* FONTS */
    --font-default:  'Roboto';
    --font-font-accent:  'Loor';
    --font-font-mono:  'SpaceMono';
    --font-size-xs:  '11px';
    --font-size-sm:  '13px';
    --font-size-md:  '15px';

    /* MARGINS */
    --margins-xs:  '5px';
    --margins-sm:  '10px';
    --margins-md:  '15px';
    --margins-lg:  '20px';

    /* ANIMATIONS */
    --default-duration: '0.25s';
    /* COLORS NOT CHANGING BETWEEN THEMES */
    --color-warning:  ${warning};
    --color-destructive:  ${destructive};
    /* COLORS */
    --color-accent: ${darkColorAccent};
    --color-accent-button:  ${darkColorAccentButton};

    --color-text:  ${darkColorText};
    --color-text-subtle:  ${darkColorTextSubtle};
    --color-text-accent:  ${darkColorTextAccent};

    --color-session-shadow: ${darkColorSessionShadow};
    --color-compose-view-background: ${darkColorComposeViewBg};
    --color-sent-message-background:  ${darkColorSentMessageBg};
    --color-sent-message-text:  ${darkColorSentMessageText};
    --color-clickable-hovered: ${darkColorClickableHovered};
    --color-session-border:  ${darkColorSessionBorder};
    --color-session-border-color:  ${darkColorSessionBorderColor};
    --color-recovery-phrase-banner-background: ${darkColorRecoveryPhraseBannerBg};
    --color-pill-divider:  ${darkColorPillDivider};
    --color-last-seen-indicator: ${darkColorLastSeenIndicator};
    --color-last-seen-indicator-text:  ${darkColorLastSeenIndicatorText};
    --color-quote-bottom-bar-background:  ${darkColorQuoteBottomBarBg};
  };
`;

export const SessionTheme = ({ children }: { children: any }) => (
  <>
    <SessionGlobalStyles />
    {children}
  </>
);
