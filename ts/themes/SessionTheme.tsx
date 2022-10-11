import React from 'react';

import { createGlobalStyle } from 'styled-components';
import { classicLight } from './';
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
