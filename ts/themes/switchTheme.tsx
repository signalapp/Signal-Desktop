import { Dispatch } from 'redux';
import { applyTheme } from '../state/ducks/theme';
import { classicDark, classicLight, oceanDark, oceanLight } from '.';
import { ThemeStateType } from './constants/colors';
import { switchHtmlToDarkTheme, switchHtmlToLightTheme } from './SessionTheme';
import { loadThemeColors } from './variableColors';

export async function switchThemeTo(
  theme: ThemeStateType,
  dispatch: Dispatch | null,
  mainWindow: boolean = true
) {
  if (mainWindow) {
    await window.setTheme(theme);
  }

  let newTheme: ThemeStateType | null = null;

  switch (theme) {
    case 'classic-dark':
      switchHtmlToDarkTheme();
      loadThemeColors(classicDark);
      newTheme = 'classic-dark';
      break;
    case 'classic-light':
      switchHtmlToLightTheme();
      loadThemeColors(classicLight);
      newTheme = 'classic-light';
      break;
    case 'ocean-dark':
      switchHtmlToDarkTheme();
      loadThemeColors(oceanDark);
      newTheme = 'ocean-dark';
      break;
    case 'ocean-light':
      switchHtmlToLightTheme();
      loadThemeColors(oceanLight);
      newTheme = 'ocean-light';
      break;
    default:
      window.log.warn('Unsupported theme: ', theme);
  }

  if (dispatch && newTheme) {
    dispatch(applyTheme(newTheme));
  }
}
