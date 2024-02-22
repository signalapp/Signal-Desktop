import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { SignInMode } from '../../../components/registration/stages/SignInTab';
import { SignUpMode } from '../../../components/registration/stages/SignUpTab';

export enum RegistrationPhase {
  Start,
  SignIn,
  SignUp,
}

export type RegistrationState = {
  generatedRecoveryPhrase: string;
  hexGeneratedPubKey: string;
  registrationPhase: RegistrationPhase;
  signUpMode: SignUpMode;
  signInMode: SignInMode;
};

const initialState: RegistrationState = {
  generatedRecoveryPhrase: '',
  hexGeneratedPubKey: '',
  registrationPhase: RegistrationPhase.Start,
  signInMode: SignInMode.Default,
  signUpMode: SignUpMode.Default,
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
    setRegistrationPhase(state, action: PayloadAction<RegistrationPhase>) {
      return { ...state, registrationPhase: action.payload };
    },
    setSignUpMode(state, action: PayloadAction<SignUpMode>) {
      return { ...state, signUpMode: action.payload };
    },
    setSignInMode(state, action: PayloadAction<SignInMode>) {
      return { ...state, signInMode: action.payload };
    },
  },
});

export const {
  setGeneratedRecoveryPhrase,
  setHexGeneratedPubKey,
  setRegistrationPhase,
  setSignUpMode,
  setSignInMode,
} = registrationSlice.actions;
export default registrationSlice.reducer;
