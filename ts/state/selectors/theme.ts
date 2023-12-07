import { ThemeStateType } from '../../themes/constants/colors';
import { StateType } from '../reducer';
import { checkDarkTheme, checkLightTheme } from '../../util/theme';

export const getTheme = (state: StateType): ThemeStateType => state.theme;

export const isDarkTheme = (state: StateType): boolean => checkDarkTheme(state.theme);

export const isLightTheme = (state: StateType): boolean => checkLightTheme(state.theme);
