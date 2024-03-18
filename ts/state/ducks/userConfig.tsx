/**
 * This slice is intended for the user configurable settings for the client such as appearance, autoplaying of links etc.
 * Anything setting under the cog wheel tab.
 */
import { createSlice } from '@reduxjs/toolkit';

export interface UserConfigState {
  audioAutoplay: boolean;
  showRecoveryPhrasePrompt: boolean;
  hideMessageRequests: boolean;
}

export const initialUserConfigState = {
  audioAutoplay: false,
  showRecoveryPhrasePrompt: true,
  hideMessageRequests: false,
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
    showMessageRequestBanner: state => {
      state.hideMessageRequests = false;
    },
    hideMessageRequestBanner: state => {
      state.hideMessageRequests = true;
    },
  },
});

const { actions, reducer } = userConfigSlice;
export const { toggleAudioAutoplay, disableRecoveryPhrasePrompt, hideMessageRequestBanner } =
  actions;
export const userConfigReducer = reducer;

export function showMessageRequestBannerOutsideRedux() {
  window.inboxStore?.dispatch(actions.showMessageRequestBanner());
}
