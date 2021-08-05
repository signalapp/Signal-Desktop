/**
 * This slice is intended for the user configurable settings for the client such as appearance, autoplaying of links etc.
 * Anything setting under the cog wheel tab.
 */
import { createSlice } from '@reduxjs/toolkit';

export interface UserConfigState {
  audioAutoplay: boolean;
  showRecoveryPhrasePrompt: boolean;
}

export const initialUserConfigState = {
  audioAutoplay: false,
  showRecoveryPhrasePrompt: true,
};

const userConfigSlice = createSlice({
  name: 'userConfig',
  initialState: initialUserConfigState,
  reducers: {
    toggleAudioAutoplay: state => {
      state.audioAutoplay = !state.audioAutoplay;
    },
    disableRecoveryPhrasePrompt: state => {
      console.log('setting recovery phrase state');
      state.showRecoveryPhrasePrompt = false
    },

  },
});

const { actions, reducer } = userConfigSlice;
export const { toggleAudioAutoplay, disableRecoveryPhrasePrompt } = actions;
export const userConfigReducer = reducer;
