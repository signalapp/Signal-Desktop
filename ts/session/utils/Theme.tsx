import { Dispatch } from 'redux';
import { switchHtmlToDarkTheme, switchHtmlToLightTheme } from '../../state/ducks/SessionTheme';
import { applyTheme, ThemeStateType } from '../../state/ducks/theme';

export async function switchThemeTo(theme: ThemeStateType, dispatch: Dispatch | null) {
  await window.setTheme(theme);

  // for now, do not switch to ocean light nor dark theme as the SessionTheme associated with them is not complete
  let newTheme: ThemeStateType | null = null;

  switch (theme) {
    case 'dark':
      switchHtmlToDarkTheme();
      newTheme = 'dark';
      break;
    case 'light':
      switchHtmlToLightTheme();
      newTheme = 'light';
      break;

    default:
      window.log.warn('Unsupported theme: ', theme);
  }

  if (newTheme) {
    dispatch?.(applyTheme(newTheme));
  }
}
