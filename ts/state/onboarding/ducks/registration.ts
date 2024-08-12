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

export type OnboardDirection = 'backward' | 'forward';

export type OnboardingState = {
  step: Onboarding;
  direction: OnboardDirection;
  accountCreationStep: AccountCreation;
  accountRestorationStep: AccountRestoration;
  progress: number;
  recoveryPassword: string;
  recoveryPasswordError: string | undefined;
  hexGeneratedPubKey: string;
  displayName: string;
  displayNameError: string | undefined;
};

const initialState: OnboardingState = {
  step: Onboarding.Start,
  direction: 'forward',
  accountCreationStep: AccountCreation.DisplayName,
  accountRestorationStep: AccountRestoration.RecoveryPassword,
  progress: 0,
  recoveryPassword: '',
  recoveryPasswordError: undefined,
  hexGeneratedPubKey: '',
  displayName: '',
  displayNameError: undefined,
};

export const registrationSlice = createSlice({
  name: 'registration',
  initialState,
  reducers: {
    resetOnboardingState() {
      return { ...initialState };
    },
    setOnboardingStep(state, action: PayloadAction<Onboarding>) {
      return { ...state, step: action.payload };
    },
    setDirection(state, action: PayloadAction<OnboardDirection>) {
      return { ...state, direction: action.payload };
    },
    setAccountCreationStep(state, action: PayloadAction<AccountCreation>) {
      return { ...state, accountCreationStep: action.payload };
    },
    setAccountRestorationStep(state, action: PayloadAction<AccountRestoration>) {
      return { ...state, accountRestorationStep: action.payload };
    },
    setProgress(state, action: PayloadAction<number>) {
      return { ...state, progress: action.payload };
    },
    setRecoveryPassword(state, action: PayloadAction<string>) {
      return { ...state, recoveryPassword: action.payload };
    },
    setRecoveryPasswordError(state, action: PayloadAction<string | undefined>) {
      return { ...state, recoveryPasswordError: action.payload };
    },
    setHexGeneratedPubKey(state, action: PayloadAction<string>) {
      return { ...state, hexGeneratedPubKey: action.payload };
    },
    setDisplayName(state, action: PayloadAction<string>) {
      return { ...state, displayName: action.payload };
    },
    setDisplayNameError(state, action: PayloadAction<string | undefined>) {
      return { ...state, displayNameError: action.payload };
    },
  },
});

export const {
  resetOnboardingState,
  setOnboardingStep,
  setDirection,
  setAccountCreationStep,
  setAccountRestorationStep,
  setProgress,
  setRecoveryPassword,
  setRecoveryPasswordError,
  setHexGeneratedPubKey,
  setDisplayName,
  setDisplayNameError,
} = registrationSlice.actions;
export default registrationSlice.reducer;
