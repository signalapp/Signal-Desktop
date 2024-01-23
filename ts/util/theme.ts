import { ThemeStateType } from '../themes/constants/colors';

export const checkDarkTheme = (theme: ThemeStateType): boolean => theme.includes('dark');
export const checkLightTheme = (theme: ThemeStateType): boolean => theme.includes('light');

export function getOppositeTheme(themeName: ThemeStateType): ThemeStateType {
  if (checkDarkTheme(themeName)) {
    return themeName.replace('dark', 'light') as ThemeStateType;
  }
  if (checkLightTheme(themeName)) {
    return themeName.replace('light', 'dark') as ThemeStateType;
  }
  // If neither 'dark' nor 'light' is in the theme name, return the original theme name.
  return themeName as ThemeStateType;
}

export function isThemeMismatched(themeName: ThemeStateType, prefersDark: boolean): boolean {
  const systemLightTheme = checkLightTheme(themeName);
  const systemDarkTheme = checkDarkTheme(themeName);
  return (prefersDark && systemLightTheme) || (!prefersDark && systemDarkTheme);
}
