import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export enum Onboarding {
  /** starting screen */
  Start,
  /** uses AccountCreation internally */
  CreateAccount,
  /** uses AccountRestoration internally */
  RestoreAccount,
}

export enum AccountCreation {
  /** starting screen */
  DisplayName,
  /** show conversation screen */
  Done,
}

export enum AccountRestoration {
  /** TODO to be removed - current starting screen */
  Start,
  /** starting screen */
  RecoveryPassword,
  /** fetching account details */
  Loading,
  /** we failed to fetch a display name in time so we choose a new one */
  DisplayName,
  /** show conversation screen */
  Complete,
  /** TODO to be removed */
  LinkDevice,
}

export type OnboardingState = {
  generatedRecoveryPhrase: string;
  hexGeneratedPubKey: string;
  step: Onboarding;
  accountCreationStep: AccountCreation;
  accountRestorationStep: AccountRestoration;
};

const initialState: OnboardingState = {
  generatedRecoveryPhrase: '',
  hexGeneratedPubKey: '',
  step: Onboarding.Start,
  accountRestorationStep: AccountRestoration.Start,
  accountCreationStep: AccountCreation.DisplayName,
};

export const registrationSlice = createSlice({
  name: 'registration',
  initialState,
  reducers: {
    setGeneratedRecoveryPhrase(state, action: PayloadAction<string>) {
      return { ...state, generatedRecoveryPhrase: action.payload };
    },
    setHexGeneratedPubKey(state, action: PayloadAction<string>) {
      return { ...state, hexGeneratedPubKey: action.payload };
    },
    setOnboardingStep(state, action: PayloadAction<Onboarding>) {
      return { ...state, step: action.payload };
    },
    setAccountCreationStep(state, action: PayloadAction<AccountCreation>) {
      return { ...state, accountCreationStep: action.payload };
    },
    setAccountRestorationStep(state, action: PayloadAction<AccountRestoration>) {
      return { ...state, accountRestorationStep: action.payload };
    },
  },
});

export const {
  setGeneratedRecoveryPhrase,
  setHexGeneratedPubKey,
  setOnboardingStep,
  setAccountCreationStep,
  setAccountRestorationStep,
} = registrationSlice.actions;
export default registrationSlice.reducer;
