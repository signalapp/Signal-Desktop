import React from 'react';

export enum SignInMode {
  Default,
  UsingRecoveryPhrase,
  LinkDevice,
}

export interface Props {
  signInMode: SignInMode;
}

export const SignInTab = (props: Props) => {};
