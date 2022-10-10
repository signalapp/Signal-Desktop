import { classicDark } from './classicDark';
import { classicLight } from './classicLight';
import { COLORS, ThemeStateType } from './constants/colors';
import { oceanDark } from './oceanDark';
import { oceanLight } from './oceanLight';
import { loadThemeColors } from './variableColors';

// document.documentElement.style.setProperty(
//   '--primary-color',
//   primaryColor && primaryColor !== THEMES.OCEAN_DARK.PRIMARY
//     ? primaryColor
//     : THEMES.OCEAN_DARK.PRIMARY
// );

export async function switchTheme(theme: ThemeStateType, mainWindow: boolean = true) {
  let primaryColor = null;

  if (mainWindow) {
    const selectedPrimaryColor = await window.Events.getPrimaryColorSetting();
    primaryColor =
      selectedPrimaryColor && (COLORS.PRIMARY as any)[`${selectedPrimaryColor.toUpperCase()}`];
  }

  // TODO Theming account for Primary colors again
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
