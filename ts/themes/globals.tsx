import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS } from './constants/colors';

// These variables are independent of the current theme
export type ThemeGlobals = {
  /* Fonts */
  '--font-default': string;
  '--font-font-accent': string;
  '--font-font-mono': string;
  '--font-size-xs': string;
  '--font-size-sm': string;
  '--font-size-md': string;
  '--font-size-lg': string;
  '--font-size-h1': string;
  '--font-size-h2': string;
  '--font-size-h3': string;
  '--font-size-h4': string;

  /* Margins */
  '--margins-xs': string;
  '--margins-sm': string;
  '--margins-md': string;
  '--margins-lg': string;
  '--margins-xl': string;

  /* Padding */
  '--padding-message-content': string;
  '--padding-link-preview': string;

  /* Border Radius */
  '--border-radius': string;
  '--border-radius-message-box': string;

  /* Sizes */
  '--main-view-header-height': string;
  '--composition-container-height': string;
  '--search-input-height': string;

  /* Animations */
  '--default-duration': string;

  /* Colors */
  '--green-color': string;
  '--blue-color': string;
  '--yellow-color': string;
  '--pink-color': string;
  '--purple-color': string;
  '--orange-color': string;
  '--red-color': string;
  '--transparent-color': string;
  '--white-color': string;
  '--black-color': string;
  '--grey-color': string;

  /* Shadows */
  '--shadow-color': string;
  '--drop-shadow': string;
  '--context-menu-shadow-color': string;
  '--scroll-button-shadow': string;

  /* Path Button */
  '--button-path-default-color': string;
  '--button-path-connecting-color': string;
  '--button-path-error-color': string;

  /* Modals */
  '--modal-background-color': string;
  '--modal-drop-shadow': string;

  /* Lightbox */
  '--lightbox-background-color': string;
  '--lightbox-caption-background-color': string;
  '--lightbox-icon-stroke-color': string;

  /* Avatar Border */
  '--avatar-border-color': string;

  /* Message Link Preview */
  /* Also used for Images */
  /* Also used for the Media Grid Items */
  /* Also used for Staged Generic Attachments */
  /* Also used for FileDropZone */
  /* Used for Quote References Not Found */
  '--message-link-preview-background-color': string;
};

// These are only set once in the global style (at root).
export const THEME_GLOBALS: ThemeGlobals = {
  '--font-default': 'Roboto',
  '--font-font-accent': 'Loor',
  '--font-font-mono': 'SpaceMono',
  '--font-size-xs': '11px',
  '--font-size-sm': '13px',
  '--font-size-md': '15px',
  '--font-size-lg': '17px',
  '--font-size-h1': '30px',
  '--font-size-h2': '24px',
  '--font-size-h3': '20px',
  '--font-size-h4': '16px',

  '--margins-xs': '5px',
  '--margins-sm': '10px',
  '--margins-md': '15px',
  '--margins-lg': '20px',
  '--margins-xl': '25px',

  '--padding-message-content': '7px 13px',
  '--padding-link-preview': '-7px -13px 7px -13px', // bottom has positive value because a link preview has always a body below

  '--border-radius': '5px',
  '--border-radius-message-box': '16px',

  '--main-view-header-height': '63px',
  '--composition-container-height': '60px',
  '--search-input-height': '34px',

  '--default-duration': '0.25s',

  '--green-color': COLORS.PRIMARY.GREEN,
  '--blue-color': COLORS.PRIMARY.BLUE,
  '--yellow-color': COLORS.PRIMARY.YELLOW,
  '--pink-color': COLORS.PRIMARY.PINK,
  '--purple-color': COLORS.PRIMARY.PURPLE,
  '--orange-color': COLORS.PRIMARY.ORANGE,
  '--red-color': COLORS.PRIMARY.RED,
  '--transparent-color': COLORS.TRANSPARENT,
  '--white-color': COLORS.WHITE,
  '--black-color': COLORS.BLACK,
  '--grey-color': COLORS.GREY,

  '--shadow-color': 'var(--black-color)',
  '--drop-shadow': '0 0 4px 0 var(--shadow-color)',
  '--context-menu-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`,
  '--scroll-button-shadow': `0 0 7px 0 rgba(${hexColorToRGB(COLORS.BLACK)}, 0.5)`,

  '--button-path-default-color': COLORS.PATH.DEFAULT,
  '--button-path-connecting-color': COLORS.PATH.CONNECTING,
  '--button-path-error-color': COLORS.PATH.ERROR,

  '--modal-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.3)`,
  '--modal-drop-shadow': `0px 0px 10px rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`,

  '--lightbox-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.8)`,
  '--lightbox-caption-background-color': 'rgba(192, 192, 192, .40)',
  '--lightbox-icon-stroke-color': 'var(--white-color)',

  '--avatar-border-color': 'var(--transparent-color)',

  '--message-link-preview-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.06)`,
};

// These should only be needed for the global style (at root).
export function declareCSSVariables(variables: Record<string, string>) {
  let output = '';
  for (const [key, value] of Object.entries(variables)) {
    output += `${key}: ${value};\n`;
  }
  return output;
}
