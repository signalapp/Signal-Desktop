/**
 * File is TSX so we get color highlighting in VS Code.
 * Primary color -> Default accent color for a theme
 */

// Colors
type Colors = {
  PRIMARY: {
    GREEN: string;
    BLUE: string;
    YELLOW: string;
    PINK: string;
    PURPLE: string;
    ORANGE: string;
    RED: string;
  };
  DANGER: {
    LIGHT: string;
    DARK: string;
  };
  PATH: {
    DEFAULT: string;
    CONNECTING: string;
    ERROR: string;
  };
  TRANSPARENT: string;
};

// Primary (can override theme default)
const primaryGreen = '#31F196';
const primaryBlue = '#57C9FA';
const primaryYellow = '#FAD657';
const primaryPink = '#FF95EF';
const primaryPurple = '#C993FF';
const primaryOrange = '#FCB159';
const primaryRed = '#FF9C8E';

// Danger
const dangerLight = '#E12D19';
const dangerDark = '#FF3A3A';

// Path
const pathDefault = primaryGreen;
const pathConnecting = primaryOrange;
const pathError = '#EA5545';

// Transparent
const transparent = 'transparent';

const COLORS: Colors = {
  PRIMARY: {
    GREEN: primaryGreen,
    BLUE: primaryBlue,
    YELLOW: primaryYellow,
    PINK: primaryPink,
    PURPLE: primaryPurple,
    ORANGE: primaryOrange,
    RED: primaryRed,
  },
  DANGER: {
    LIGHT: dangerLight,
    DARK: dangerDark,
  },
  PATH: {
    DEFAULT: pathDefault,
    CONNECTING: pathConnecting,
    ERROR: pathError,
  },
  TRANSPARENT: transparent,
};

// Themes
type ThemeNames = 'CLASSIC_LIGHT' | 'CLASSIC_DARK' | 'OCEAN_LIGHT' | 'OCEAN_DARK';
type ThemeColors = {
  PRIMARY: string;
  COLOR0: string;
  COLOR1: string;
  COLOR2: string;
  COLOR3: string;
  COLOR4: string;
  COLOR5: string;
  COLOR6: string;
};
type Themes = Record<ThemeNames, ThemeColors>;

// Classic Light
const classicLightPrimary = '#31F196';
const classicLight0 = '#000000';
const classicLight1 = '#6D6D6D';
const classicLight2 = '#A1A2A1';
const classicLight3 = '#DFDFDF';
const classicLight4 = '#F0F0F0';
const classicLight5 = '#F9F9F9';
const classicLight6 = '#FFFFFF';

// Classic Dark
const classicDarkPrimary = '#31F196';
const classicDark0 = '#000000';
const classicDark1 = '#1B1B1B';
const classicDark2 = '#2D2D2D';
const classicDark3 = '#414141';
const classicDark4 = '#767676';
const classicDark5 = '#A1A2A1';
const classicDark6 = '#FFFFFF';

// Ocean Light
const oceanLightPrimary = '#57C9FA';
const oceanLight0 = '#000000';
const oceanLight1 = '#1A1C28';
const oceanLight2 = '#252735';
const oceanLight3 = '#2B2D40';
const oceanLight4 = '#3D4A5D';
const oceanLight5 = '#A6A9CE';
const oceanLight6 = '#FFFFFF';

// Ocean Dark
const oceanDarkPrimary = '#57C9FA';
const oceanDark0 = '#19345D';
const oceanDark1 = '#6A6E90';
const oceanDark2 = '#5CAACC';
const oceanDark3 = '#B3EDF2';
const oceanDark4 = '#E7F3F4';
const oceanDark5 = '#ECFAFB';
const oceanDark6 = '#FCFFFF';

const THEMES: Themes = {
  CLASSIC_LIGHT: {
    PRIMARY: classicLightPrimary,
    COLOR0: classicLight0,
    COLOR1: classicLight1,
    COLOR2: classicLight2,
    COLOR3: classicLight3,
    COLOR4: classicLight4,
    COLOR5: classicLight5,
    COLOR6: classicLight6,
  },
  CLASSIC_DARK: {
    PRIMARY: classicDarkPrimary,
    COLOR0: classicDark0,
    COLOR1: classicDark1,
    COLOR2: classicDark2,
    COLOR3: classicDark3,
    COLOR4: classicDark4,
    COLOR5: classicDark5,
    COLOR6: classicDark6,
  },
  OCEAN_LIGHT: {
    PRIMARY: oceanLightPrimary,
    COLOR0: oceanLight0,
    COLOR1: oceanLight1,
    COLOR2: oceanLight2,
    COLOR3: oceanLight3,
    COLOR4: oceanLight4,
    COLOR5: oceanLight5,
    COLOR6: oceanLight6,
  },
  OCEAN_DARK: {
    PRIMARY: oceanDarkPrimary,
    COLOR0: oceanDark0,
    COLOR1: oceanDark1,
    COLOR2: oceanDark2,
    COLOR3: oceanDark3,
    COLOR4: oceanDark4,
    COLOR5: oceanDark5,
    COLOR6: oceanDark6,
  },
};

export { COLORS, THEMES };
