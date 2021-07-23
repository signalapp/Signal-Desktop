import { StateType } from '../reducer';
import { TimerOptionsState } from '../ducks/timerOptions';

export const getTimerOptions = (state: StateType): TimerOptionsState => state.timerOptions;
