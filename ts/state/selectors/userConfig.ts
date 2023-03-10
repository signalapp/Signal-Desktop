import { StateType } from '../reducer';

export const getAudioAutoplay = (state: StateType): boolean => state.userConfig.audioAutoplay;

export const getShowRecoveryPhrasePrompt = (state: StateType): boolean =>
  state.userConfig?.showRecoveryPhrasePrompt || false;

export const getHideMessageRequestBanner = (state: StateType): boolean => {
  // I am not too sure why, but it seems that state.userConfig is not set early enough and we try to somehow fetch this too early?
  return state.userConfig?.hideMessageRequests || false;
};

export const getHideMessageRequestBannerOutsideRedux = (): boolean => {
  const state = window.inboxStore?.getState();

  return state ? getHideMessageRequestBanner(state) : true;
};
