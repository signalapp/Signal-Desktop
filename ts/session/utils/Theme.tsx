import { Dispatch } from 'redux';
import { applyTheme } from '../../state/ducks/theme';
import { ThemeStateType } from '../../themes/colors';
import { switchHtmlToDarkTheme, switchHtmlToLightTheme } from '../../themes/SessionTheme';
import { switchTheme } from '../../themes/switchTheme';

export async function switchThemeTo(theme: ThemeStateType, dispatch: Dispatch | null) {
  await window.setTheme(theme);

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

  switchTheme(theme);

  if (newTheme) {
    dispatch?.(applyTheme(newTheme));
  }
}
