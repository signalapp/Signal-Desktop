import { ThemeStateType } from '../../themes/constants/colors';
import { StateType } from '../reducer';

export const getTheme = (state: StateType): ThemeStateType => state.theme;

export const isDarkTheme = (state: StateType): boolean => state.theme.includes('dark');

export const isLightTheme = (state: StateType): boolean => state.theme.includes('light');
