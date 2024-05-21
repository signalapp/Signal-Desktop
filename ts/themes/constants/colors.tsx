/**
 * File is TSX so we get color highlighting in VS Code.
 * Primary color -> Default accent color for a theme
 */

// Colors
export type ColorsType = {
  PRIMARY: {
    GREEN: string;
    BLUE: string;
    YELLOW: string;
    PINK: string;
    PURPLE: string;
    ORANGE: string;
    RED: string;
  };
  PATH: {
    DEFAULT: string;
    CONNECTING: string;
    ERROR: string;
  };
  SESSION: string;
  TRANSPARENT: string;
  WHITE: string;
  BLACK: string;
  GREY: string;
};

// Session Brand Color
const sessionGreen = '#00f782';

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

// Disabled
const disabledLight = '#6D6D6D';
const disabledDark = '#A1A2A1';

// Path
const pathDefault = primaryGreen;
const pathConnecting = primaryOrange;
const pathError = '#EA5545';

// Transparent
const transparent = 'transparent';

// White
const white = '#FFFFFF';

// Black
const black = '#000000';

// Grey
const grey = '#616161';

const COLORS: ColorsType = {
  PRIMARY: {
    GREEN: primaryGreen,
    BLUE: primaryBlue,
    YELLOW: primaryYellow,
    PINK: primaryPink,
    PURPLE: primaryPurple,
    ORANGE: primaryOrange,
    RED: primaryRed,
  },
  PATH: {
    DEFAULT: pathDefault,
    CONNECTING: pathConnecting,
    ERROR: pathError,
  },
  SESSION: sessionGreen,
  TRANSPARENT: transparent,
  WHITE: white,
  BLACK: black,
  GREY: grey,
};

export type PrimaryColorStateType =
  | 'green'
  | 'blue'
  | 'yellow'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'red';

type PrimaryColorType = { id: PrimaryColorStateType; ariaLabel: string; color: string };

export const getPrimaryColors = (): Array<PrimaryColorType> => [
  { id: 'green', ariaLabel: window.i18n('primaryColorGreen'), color: COLORS.PRIMARY.GREEN },
  { id: 'blue', ariaLabel: window.i18n('primaryColorBlue'), color: COLORS.PRIMARY.BLUE },
  { id: 'yellow', ariaLabel: window.i18n('primaryColorYellow'), color: COLORS.PRIMARY.YELLOW },
  { id: 'pink', ariaLabel: window.i18n('primaryColorPink'), color: COLORS.PRIMARY.PINK },
  { id: 'purple', ariaLabel: window.i18n('primaryColorPurple'), color: COLORS.PRIMARY.PURPLE },
  { id: 'orange', ariaLabel: window.i18n('primaryColorOrange'), color: COLORS.PRIMARY.ORANGE },
  { id: 'red', ariaLabel: window.i18n('primaryColorRed'), color: COLORS.PRIMARY.RED },
];

// Themes
export type ThemeStateType = 'classic-light' | 'classic-dark' | 'ocean-light' | 'ocean-dark'; // used for redux state

type ThemeNames = 'CLASSIC_LIGHT' | 'CLASSIC_DARK' | 'OCEAN_LIGHT' | 'OCEAN_DARK';

export function convertThemeStateToName(themeState: string): ThemeNames {
  return themeState.replace('-', '_').toUpperCase() as ThemeNames;
}

type ThemeColors = {
  PRIMARY: string;
  DANGER: string;
  DISABLED: string;
  COLOR0: string;
  COLOR1: string;
  COLOR2: string;
  COLOR3: string;
  COLOR4: string;
  COLOR5: string;
  COLOR6: string;
  COLOR7?: string; // Only used with Ocean Themes
};
type Themes = Record<ThemeNames, ThemeColors>;

// Classic Light
const classicLightPrimary = primaryGreen;
const classicLightDanger = dangerLight;
const classicLightDisabled = disabledLight;
const classicLight0 = '#000000';
const classicLight1 = '#6D6D6D';
const classicLight2 = '#A1A2A1';
const classicLight3 = '#DFDFDF';
const classicLight4 = '#F0F0F0';
const classicLight5 = '#F9F9F9';
const classicLight6 = '#FFFFFF';

// Classic Dark
const classicDarkPrimary = primaryGreen;
const classicDarkDanger = dangerDark;
const classicDarkDisabled = disabledDark;
const classicDark0 = '#000000';
const classicDark1 = '#1B1B1B';
const classicDark2 = '#2D2D2D';
const classicDark3 = '#414141';
const classicDark4 = '#767676';
const classicDark5 = '#A1A2A1';
const classicDark6 = '#FFFFFF';

// Ocean Light
const oceanLightPrimary = primaryBlue;
const oceanLightDanger = dangerLight;
const oceanLightDisabled = disabledLight;
const oceanLight0 = '#000000';
const oceanLight1 = '#19345D';
const oceanLight2 = '#6A6E90';
const oceanLight3 = '#5CAACC';
const oceanLight4 = '#B3EDF2';
const oceanLight5 = '#E7F3F4';
const oceanLight6 = '#ECFAFB';
const oceanLight7 = '#FCFFFF';

// Ocean Dark
const oceanDarkPrimary = primaryBlue;
const oceanDarkDanger = dangerDark;
const oceanDarkDisabled = disabledDark;
const oceanDark0 = '#000000';
const oceanDark1 = '#1A1C28';
const oceanDark2 = '#252735';
const oceanDark3 = '#2B2D40';
const oceanDark4 = '#3D4A5D';
const oceanDark5 = '#A6A9CE';
const oceanDark6 = '#5CAACC';
const oceanDark7 = '#FFFFFF';

const THEMES: Themes = {
  CLASSIC_LIGHT: {
    PRIMARY: classicLightPrimary,
    DANGER: classicLightDanger,
    DISABLED: classicLightDisabled,
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
    DANGER: classicDarkDanger,
    DISABLED: classicDarkDisabled,
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
    DANGER: oceanLightDanger,
    DISABLED: oceanLightDisabled,
    COLOR0: oceanLight0,
    COLOR1: oceanLight1,
    COLOR2: oceanLight2,
    COLOR3: oceanLight3,
    COLOR4: oceanLight4,
    COLOR5: oceanLight5,
    COLOR6: oceanLight6,
    COLOR7: oceanLight7,
  },
  OCEAN_DARK: {
    PRIMARY: oceanDarkPrimary,
    DANGER: oceanDarkDanger,
    DISABLED: oceanDarkDisabled,
    COLOR0: oceanDark0,
    COLOR1: oceanDark1,
    COLOR2: oceanDark2,
    COLOR3: oceanDark3,
    COLOR4: oceanDark4,
    COLOR5: oceanDark5,
    COLOR6: oceanDark6,
    COLOR7: oceanDark7,
  },
};

type ThemeType = {
  id: ThemeStateType;
  title: string;
  style: StyleSessionSwitcher;
};

export type StyleSessionSwitcher = {
  background: string;
  border: string;
  receivedBackground: string;
  sentBackground: string;
};

export const getThemeColors = (): Array<ThemeType> => [
  {
    id: 'classic-dark',
    title: window.i18n('classicDarkThemeTitle'),
    style: {
      background: THEMES.CLASSIC_DARK.COLOR0,
      border: THEMES.CLASSIC_DARK.COLOR3,
      receivedBackground: THEMES.CLASSIC_DARK.COLOR2,
      sentBackground: THEMES.CLASSIC_DARK.PRIMARY,
    },
  },
  {
    id: 'classic-light',
    title: window.i18n('classicLightThemeTitle'),
    style: {
      background: THEMES.CLASSIC_LIGHT.COLOR6,
      border: THEMES.CLASSIC_LIGHT.COLOR3,
      receivedBackground: THEMES.CLASSIC_LIGHT.COLOR4,
      sentBackground: THEMES.CLASSIC_LIGHT.PRIMARY,
    },
  },
  {
    id: 'ocean-dark',
    title: window.i18n('oceanDarkThemeTitle'),
    style: {
      background: THEMES.OCEAN_DARK.COLOR2,
      border: THEMES.OCEAN_DARK.COLOR4,
      receivedBackground: THEMES.OCEAN_DARK.COLOR4,
      sentBackground: THEMES.OCEAN_DARK.PRIMARY,
    },
  },
  {
    id: 'ocean-light',
    title: window.i18n('oceanLightThemeTitle'),
    style: {
      background: THEMES.OCEAN_LIGHT.COLOR7!,
      border: THEMES.OCEAN_LIGHT.COLOR3,
      receivedBackground: THEMES.OCEAN_LIGHT.COLOR1,
      sentBackground: THEMES.OCEAN_LIGHT.PRIMARY,
    },
  },
];

export { COLORS, THEMES };
