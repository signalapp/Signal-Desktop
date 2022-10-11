import React from 'react';

import { createGlobalStyle } from 'styled-components';
import { classicLight } from './';
import { declareCSSVariables, THEME_GLOBALS } from './globals';

const whiteColorRGB = '255, 255, 255'; // we need rgb values if we want css variables within rgba
const destructiveAltColorRGB = '255, 69, 56';

// THEME INDEPEDENT COLORS
const avatarBorderColor = '#00000059';

// default to classic light theme
export const SessionGlobalStyles = createGlobalStyle`
  html {
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
    --border-radius: 5px;

    /* SIZES */
    --main-view-header-height: 63px;

    /* ANIMATIONS */
    --default-duration: 0.25s;

    /* CONSTANTS */
    --composition-container-height: 60px;
    --search-input-height: 34px;

    /* COLORS NOT CHANGING BETWEEN THEMES */

    --color-white-color-rgb: ${whiteColorRGB};
    --color-destructive-alt-rgb: ${destructiveAltColorRGB};
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
