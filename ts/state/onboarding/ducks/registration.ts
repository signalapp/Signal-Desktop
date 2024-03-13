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
  /** starting screen */
  RecoveryPassword,
  /** fetching account details, so we increment progress to 100% over 15s */
  Loading,
  /** found account details, so we increment the remaining progress to 100% over 0.3s */
  Finishing,
  /** found the account details and the progress is now 100%, so we wait for 0.2s */
  Finished,
  /** we failed to fetch account details in time, so we enter it manually */
  DisplayName,
  /** we have restored successfuly, show the conversation screen */
  Complete,
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
  accountRestorationStep: AccountRestoration.RecoveryPassword,
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
