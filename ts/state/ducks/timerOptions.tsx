/**
 * This slice is intended for the user configurable settings for the client such as appearance, autoplaying of links etc.
 * Anything setting under the cog wheel tab.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type TimerOptionsEntry = { name: string; value: number };
export type TimerOptionsArray = Array<TimerOptionsEntry>;

export type TimerOptionsState = {
  timerOptions: TimerOptionsArray;
};

export const initialTimerOptionsState: TimerOptionsState = {
  timerOptions: [],
};

const timerOptionSlice = createSlice({
  name: 'timerOptions',
  initialState: initialTimerOptionsState,
  reducers: {
    updateTimerOptions: (state, action: PayloadAction<TimerOptionsArray>) => {
      return { ...state, timerOptions: action.payload };
    },
  },
});

const { actions, reducer } = timerOptionSlice;
export const { updateTimerOptions } = actions;
export const timerOptionReducer = reducer;
