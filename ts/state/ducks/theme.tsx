export const APPLY_THEME = 'APPLY_THEME';

export type ThemeStateType = 'light' | 'dark';
export const applyTheme = (theme: ThemeStateType) => {
  return {
    type: APPLY_THEME,
    payload: theme,
  };
};

export const initialThemeState: ThemeStateType = 'light';

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
