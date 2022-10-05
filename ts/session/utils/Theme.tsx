import { Dispatch } from 'redux';
import { applyTheme } from '../../state/ducks/theme';
import { ThemeStateType } from '../../themes/colors';
import { switchHtmlToDarkTheme, switchHtmlToLightTheme } from '../../themes/SessionTheme';
import { switchTheme } from '../../themes/switchTheme';

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
      newTheme = 'classic-dark';
      break;
    case 'classic-light':
      switchHtmlToLightTheme();
      newTheme = 'classic-light';
      break;
    case 'ocean-dark':
      switchHtmlToDarkTheme();
      newTheme = 'ocean-dark';
      break;
    case 'ocean-light':
      switchHtmlToLightTheme();
      newTheme = 'ocean-light';
      break;
    default:
      window.log.warn('Unsupported theme: ', theme);
  }

  if (newTheme) {
    switchTheme(newTheme, mainWindow);
    if (dispatch) {
      dispatch?.(applyTheme(newTheme));
    }
  }
}
