export const APPLY_THEME = 'APPLY_THEME';
export type ThemeStateType = typeof lightTheme;

export const applyTheme = (theme: ThemeStateType) => {
  return {
    type: APPLY_THEME,
    payload: theme,
  };
};
import { lightTheme } from './SessionTheme';

export const initialThemeState = lightTheme;

export const reducer = (
  state: any = initialThemeState,
  {
    type,
    payload,
  }: {
    type: string;
    payload: ThemeStateType;
  }
): ThemeStateType => {
  switch (type) {
    case APPLY_THEME:
      return payload;
    default:
      return state;
  }
};

export const actions = {
  applyTheme,
};
