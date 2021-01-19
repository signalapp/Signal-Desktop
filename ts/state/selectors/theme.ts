import { StateType } from '../reducer';
import { ThemeStateType } from '../ducks/theme';

export const getTheme = (state: StateType): ThemeStateType => state.theme;
