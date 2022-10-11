import { ThemeStateType } from '../../themes/constants/colors';
import { StateType } from '../reducer';

export const getTheme = (state: StateType): ThemeStateType => state.theme;
