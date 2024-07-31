import { Dispatch } from '@reduxjs/toolkit';
import { classicDark, classicLight, oceanDark, oceanLight } from '.';
import { updateTheme } from '../state/ducks/theme';
import { THEMES, ThemeStateType, convertThemeStateToName } from './constants/colors';
import { setThemeValues } from './globals';
import { findPrimaryColorId, switchPrimaryColorTo } from './switchPrimaryColor';

type SwitchThemeProps = {
  theme: ThemeStateType;
  mainWindow?: boolean;
  usePrimaryColor?: boolean;
  dispatch?: Dispatch;
};

export async function switchThemeTo(props: SwitchThemeProps) {
  const { theme, mainWindow, usePrimaryColor, dispatch } = props;
  let newTheme: ThemeStateType | null = null;

  switch (theme) {
    case 'classic-dark':
      setThemeValues(classicDark);
      newTheme = 'classic-dark';
      break;
    case 'classic-light':
      setThemeValues(classicLight);
      newTheme = 'classic-light';
      break;
    case 'ocean-dark':
      setThemeValues(oceanDark);
      newTheme = 'ocean-dark';
      break;
    case 'ocean-light':
      setThemeValues(oceanLight);
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
      dispatch(updateTheme(newTheme));
      if (usePrimaryColor) {
        // Set primary color after the theme is loaded so that it's not overwritten
        const primaryColor = window.Events.getPrimaryColorSetting();
        await switchPrimaryColorTo(primaryColor, dispatch);
      } else {
        // By default, when we change themes we want to reset the primary color
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
