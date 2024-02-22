import { createSelector } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { SignInMode, SignUpMode } from '../../../components/registration/stages';
import { RegistrationPhase, RegistrationState } from '../ducks/registration';
import { OnboardingStoreState } from '../store';

// #region Getters
const getRegistration = (state: OnboardingStoreState): RegistrationState => {
  return state.registration;
};

const getGeneratedRecoveryPhrase = createSelector(
  getRegistration,
  (state: RegistrationState): string => state.generatedRecoveryPhrase
);

const getHexGeneratedPubKey = createSelector(
  getRegistration,
  (state: RegistrationState): string => state.hexGeneratedPubKey
);

const getRegistrationPhase = createSelector(
  getRegistration,
  (state: RegistrationState): RegistrationPhase => state.registrationPhase
);

const getSignUpMode = createSelector(
  getRegistration,
  (state: RegistrationState): SignUpMode => state.signUpMode
);

const getSignInMode = createSelector(
  getRegistration,
  (state: RegistrationState): SignInMode => state.signInMode
);
// #endregion

// #region Hooks
export const useRegGeneratedRecoveryPhrase = () => {
  return useSelector(getGeneratedRecoveryPhrase);
};

export const useRegHexGeneratedPubKey = () => {
  return useSelector(getHexGeneratedPubKey);
};

export const useRegRegistrationPhase = () => {
  return useSelector(getRegistrationPhase);
};

export const useRegSignUpMode = () => {
  return useSelector(getSignUpMode);
};

export const useRegSignInMode = () => {
  return useSelector(getSignInMode);
};
// #endregion
