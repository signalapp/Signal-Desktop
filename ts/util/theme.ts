import { ThemeStateType } from '../themes/constants/colors';

export function getOppositeTheme(themeName: string): ThemeStateType {
  if (themeName.includes('dark')) {
    return themeName.replace('dark', 'light') as ThemeStateType;
  }
  if (themeName.includes('light')) {
    return themeName.replace('light', 'dark') as ThemeStateType;
  }
  // If neither 'dark' nor 'light' is in the theme name, return the original theme name.
  return themeName as ThemeStateType;
}

export function isThemeMismatched(themeName: string, prefersDark: boolean): boolean {
  const isLightTheme = themeName.includes('light');
  const isDarkTheme = themeName.includes('dark');
  return (prefersDark && isLightTheme) || (!prefersDark && isDarkTheme);
}
