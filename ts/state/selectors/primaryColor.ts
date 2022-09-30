import { PrimaryColorStateType } from '../../themes/colors';
import { StateType } from '../reducer';

export const getPrimaryColor = (state: StateType): PrimaryColorStateType => state.primaryColor;
