import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS } from './constants/colors';

// For now this only keeps the colors
// TODO Theming add margin, padding, font, variables here.
export type ThemeGlobals = {
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

  /* Shadows */
  '--shadow-color': string;
  '--drop-shadow': string;
  '--context-menu-shadow-color': string;

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
};

// These are only set once in the global style (at root).
export const THEME_GLOBALS: ThemeGlobals = {
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

  '--shadow-color': 'var(--black-color)',
  '--drop-shadow': `0 0 4px 0 var(--shadow-color)`,
  '--context-menu-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`,

  '--button-path-default-color': COLORS.PATH.DEFAULT,
  '--button-path-connecting-color': COLORS.PATH.CONNECTING,
  '--button-path-error-color': COLORS.PATH.ERROR,

  '--modal-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.3)`,
  '--modal-drop-shadow': `0px 0px 10px  rgba(${hexColorToRGB(COLORS.BLACK)}, 0.22)`,

  '--lightbox-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.8)`,
  '--lightbox-caption-background-color': 'rgba(192, 192, 192, .40)',
  '--lightbox-icon-stroke-color': 'var(--white-color)',
};

// These should only be needed for the global style (at root).
export function declareCSSVariables(variables: Record<string, string>) {
  let output = '';
  for (const [key, value] of Object.entries(variables)) {
    console.log(`${key}: ${value}`);
    output += `${key}: ${value};\n`;
  }
  return output;
}
