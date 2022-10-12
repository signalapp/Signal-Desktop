import React from 'react';

import { createGlobalStyle } from 'styled-components';
import { classicDark } from './';
import { declareCSSVariables, THEME_GLOBALS } from './globals';

// Defaults to Classic Dark theme
export const SessionGlobalStyles = createGlobalStyle`
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
