import { classicDark, classicLight, oceanDark, oceanLight } from '.';
import { ThemeStateType } from './constants/colors';
import { loadThemeColors } from './variableColors';

export async function switchTheme(theme: ThemeStateType) {
  switch (theme) {
    case 'classic-light':
      loadThemeColors(classicLight);
      break;
    case 'classic-dark':
      loadThemeColors(classicDark);
      break;
    case 'ocean-light':
      loadThemeColors(oceanLight);
      break;
    case 'ocean-dark':
      loadThemeColors(oceanDark);
      break;
    default:
      window.log.warn('Unsupported theme:', theme);
      break;
  }
}
