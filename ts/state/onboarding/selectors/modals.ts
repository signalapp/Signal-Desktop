import { createSelector } from '@reduxjs/toolkit';
import { ConfirmModalState } from '../../ducks/modalDialog';
import { ModalsState, TermsOfServicePrivacyModalState } from '../ducks/modals';
import { OnboardingStoreState } from '../store';

const getModals = (state: OnboardingStoreState): ModalsState => {
  return state.modals;
};

export const getQuitModalState = createSelector(
  getModals,
  (state: ModalsState): ConfirmModalState => state.quitModalState
);

export const getTermsOfServicePrivacyModalState = createSelector(
  getModals,
  (state: ModalsState): TermsOfServicePrivacyModalState => state.termsOfServicePrivacyModalState
);
