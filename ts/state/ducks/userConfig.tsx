/**
 * This slice is intended for the user configurable settings for the client such as appearance, autoplaying of links etc.
 * Anything setting under the cog wheel tab.
 */
import { createSlice } from '@reduxjs/toolkit';

export interface UserConfigState {
  audioAutoplay: boolean;
}

export const initialUserConfigState = {
  audioAutoplay: false,
};

const userConfigSlice = createSlice({
  name: 'userConfig',
  initialState: initialUserConfigState,
  reducers: {
    toggleAudioAutoplay: state => {
      state.audioAutoplay = !state.audioAutoplay;
    },
  },
});

const { actions, reducer } = userConfigSlice;
export const { toggleAudioAutoplay } = actions;
export const userConfigReducer = reducer;
