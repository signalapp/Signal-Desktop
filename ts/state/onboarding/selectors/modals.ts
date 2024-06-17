import { createSelector } from '@reduxjs/toolkit';
import { ModalsState, TermsOfServicePrivacyModalState } from '../ducks/modals';
import { OnboardingStoreState } from '../store';

const getModals = (state: OnboardingStoreState): ModalsState => {
  return state.modals;
};

export const getTermsOfServicePrivacyModalState = createSelector(
  getModals,
  (state: ModalsState): TermsOfServicePrivacyModalState => state.termsOfServicePrivacyModalState
);
