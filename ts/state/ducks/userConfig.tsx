/**
 * This slice is intended for the user configurable settings for the client such as appearance, autoplaying of links etc.
 * Anything setting under the cog wheel tab.
 */
import { createSlice } from '@reduxjs/toolkit';

export interface UserConfigState {
  audioAutoplay: boolean;
  showRecoveryPhrasePrompt: boolean;
  messageRequests: boolean;
}

export const initialUserConfigState = {
  audioAutoplay: false,
  showRecoveryPhrasePrompt: true,
  messageRequests: true,
};

const userConfigSlice = createSlice({
  name: 'userConfig',
  initialState: initialUserConfigState,
  reducers: {
    toggleAudioAutoplay: state => {
      state.audioAutoplay = !state.audioAutoplay;
    },
    disableRecoveryPhrasePrompt: state => {
      state.showRecoveryPhrasePrompt = false;
    },
    toggleMessageRequests: state => {
      state.messageRequests = !state.messageRequests;
    },
  },
});

const { actions, reducer } = userConfigSlice;
export const { toggleAudioAutoplay, disableRecoveryPhrasePrompt, toggleMessageRequests } = actions;
export const userConfigReducer = reducer;
