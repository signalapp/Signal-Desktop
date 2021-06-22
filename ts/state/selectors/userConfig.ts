import { StateType } from '../reducer';
import { UserConfigState } from "../ducks/userConfig";

export const getUserConfig = (state: StateType): UserConfigState => state.userConfig;
