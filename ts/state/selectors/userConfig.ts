import { StateType } from '../reducer';
import { UserConfigState } from '../ducks/userConfig';
import { createSelector } from 'reselect';

export const getUserConfig = (state: StateType): UserConfigState => state.userConfig;

export const getAudioAutoplay = createSelector(
  getUserConfig,
  (state: UserConfigState): boolean => state.audioAutoplay
);

export const getShowRecoveryPhrasePrompt = createSelector(
  getUserConfig,
  (state: UserConfigState): boolean => state.showRecoveryPhrasePrompt
);

export const getHideMessageRequestBanner = createSelector(
  getUserConfig,
  (state: UserConfigState): boolean => state.hideMessageRequests
);
