import { createSelector } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { ThemeStateType } from '../../themes/constants/colors';
import { checkDarkTheme, checkLightTheme } from '../../util/theme';
import { StateType } from '../reducer';

export const getTheme = (state: StateType): ThemeStateType => state.theme;

const getIsDarkTheme = createSelector(getTheme, (state): boolean => checkDarkTheme(state));

const getIsLightTheme = createSelector(getTheme, (state): boolean => checkLightTheme(state));

export const useTheme = () => useSelector(getTheme);

export const useIsDarkTheme = () => useSelector(getIsDarkTheme);

export const useIsLightTheme = () => useSelector(getIsLightTheme);
