import { ThemeStateType } from '../../themes/colors';
import { StateType } from '../reducer';

export const getTheme = (state: StateType): ThemeStateType => state.theme;
