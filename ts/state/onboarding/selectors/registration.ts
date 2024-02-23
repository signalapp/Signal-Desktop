import { createSelector } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
  OnboardingState,
} from '../ducks/registration';
import { OnboardingStoreState } from '../store';

// #region Getters
const getRegistration = (state: OnboardingStoreState): OnboardingState => {
  return state.registration;
};

const getGeneratedRecoveryPhrase = createSelector(
  getRegistration,
  (state: OnboardingState): string => state.generatedRecoveryPhrase
);

const getHexGeneratedPubKey = createSelector(
  getRegistration,
  (state: OnboardingState): string => state.hexGeneratedPubKey
);

const getOnboardingStep = createSelector(
  getRegistration,
  (state: OnboardingState): Onboarding => state.step
);

const getAccountCreationStep = createSelector(
  getRegistration,
  (state: OnboardingState): AccountCreation => state.accountCreationStep
);

const getAccountRestorationStep = createSelector(
  getRegistration,
  (state: OnboardingState): AccountRestoration => state.accountRestorationStep
);
// #endregion

// #region Hooks
export const useOnboardGeneratedRecoveryPhrase = () => {
  return useSelector(getGeneratedRecoveryPhrase);
};

export const useOnboardHexGeneratedPubKey = () => {
  return useSelector(getHexGeneratedPubKey);
};

export const useOnboardStep = () => {
  return useSelector(getOnboardingStep);
};

export const useOnboardAccountCreationStep = () => {
  return useSelector(getAccountCreationStep);
};

export const useOnboardAccountRestorationStep = () => {
  return useSelector(getAccountRestorationStep);
};
// #endregion
