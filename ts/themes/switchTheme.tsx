import { Dispatch } from 'redux';
import { applyTheme } from '../state/ducks/theme';
import { classicDark, classicLight, oceanDark, oceanLight } from '.';
import { convertThemeStateToName, THEMES, ThemeStateType } from './constants/colors';
import { switchHtmlToDarkTheme, switchHtmlToLightTheme } from './SessionTheme';
import { loadThemeColors } from './variableColors';
import { findPrimaryColorId, switchPrimaryColorTo } from './switchPrimaryColor';

type SwitchThemeProps = {
  theme: ThemeStateType;
  mainWindow: boolean;
  resetPrimaryColor: boolean;
  dispatch?: Dispatch;
};

export async function switchThemeTo(props: SwitchThemeProps) {
  const { theme, mainWindow = true, resetPrimaryColor = true, dispatch } = props;
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

  if (newTheme) {
    if (mainWindow) {
      await window.setTheme(theme);
    }

    if (dispatch) {
      dispatch(applyTheme(newTheme));
      if (resetPrimaryColor) {
        const defaultPrimaryColor = findPrimaryColorId(
          THEMES[convertThemeStateToName(newTheme)].PRIMARY
        );
        if (defaultPrimaryColor) {
          await switchPrimaryColorTo(defaultPrimaryColor, dispatch);
        }
      }
    }
  }
}
