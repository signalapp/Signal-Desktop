import React, { useState } from 'react';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { validatePassword } from './RegistrationTabs';
import { RegistrationUserDetails } from './RegistrationUserDetails';
import { TermsAndConditions } from './TermsAndConditions';

export enum SignInMode {
  Default,
  UsingRecoveryPhrase,
  LinkDevice,
}
// tslint:disable: use-simple-attributes
// tslint:disable: react-unused-props-and-state

export interface Props {}

const LinkDeviceButton = (props: { onLinkDeviceButtonClicked: () => any }) => {
  return (
    <SessionButton
      onClick={props.onLinkDeviceButtonClicked}
      buttonType={SessionButtonType.BrandOutline}
      buttonColor={SessionButtonColor.Green}
      text={window.i18n('linkDevice')}
    />
  );
};

const RestoreUsingRecoveryPhraseButton = (props: {
  onRecoveryButtonClicked: () => any;
}) => {
  return (
    <SessionButton
      onClick={props.onRecoveryButtonClicked}
      buttonType={SessionButtonType.BrandOutline}
      buttonColor={SessionButtonColor.Green}
      text={window.i18n('restoreUsingRecoveryPhrase')}
    />
  );
};

const ContinueYourSessionButton = (props: {
  handleContinueYourSessionClick: () => any;
}) => {
  return (
    <SessionButton
      onClick={props.handleContinueYourSessionClick}
      buttonType={SessionButtonType.Brand}
      buttonColor={SessionButtonColor.Green}
      text={window.i18n('continueYourSession')}
    />
  );
};

const SignInButtons = (props: {
  signInMode: SignInMode;
  onRecoveryButtonClicked: () => any;
  onLinkDeviceButtonClicked: () => any;
  handleContinueYourSessionClick: () => any;
}) => {
  if (props.signInMode === SignInMode.Default) {
    return (
      <div>
        <RestoreUsingRecoveryPhraseButton
          onRecoveryButtonClicked={props.onRecoveryButtonClicked}
        />
        <div className="or">{window.i18n('or')}</div>
        <LinkDeviceButton
          onLinkDeviceButtonClicked={props.onLinkDeviceButtonClicked}
        />
      </div>
    );
  }
  return (
    <ContinueYourSessionButton
      handleContinueYourSessionClick={props.handleContinueYourSessionClick}
    />
  );
};

export const SignInTab = (props: Props) => {
  const [signInMode, setSignInMode] = useState(SignInMode.Default);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryPhraseError, setRecoveryPhraseError] = useState(
    undefined as string | undefined
  );
  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVerify, setPasswordVerify] = useState('');
  const [passwordErrorString, setPasswordErrorString] = useState('');
  const [passwordFieldsMatch, setPasswordFieldsMatch] = useState(false);

  const showTermsAndConditions = signInMode !== SignInMode.Default;

  return (
    <div className="session-registration__content">
      {signInMode !== SignInMode.Default && (
        <RegistrationUserDetails
          showDisplayNameField={signInMode === SignInMode.UsingRecoveryPhrase}
          showSeedField={true}
          displayName={displayName}
          handlePressEnter={() => {
            throw new Error('TODO');
          }}
          onDisplayNameChanged={(name: string) => {
            const sanitizedName = name.replace(window.displayNameRegex, '');
            const trimName = sanitizedName.trim();
            setDisplayName(sanitizedName);
            setDisplayNameError(
              !trimName ? window.i18n('displayNameEmpty') : undefined
            );
          }}
          onPasswordChanged={(val: string) => {
            setPassword(val);
            const errors = validatePassword(val, passwordVerify);
            setPasswordErrorString(errors.passwordErrorString);
            setPasswordFieldsMatch(errors.passwordFieldsMatch);
          }}
          onPasswordVerifyChanged={(val: string) => {
            setPasswordVerify(val);
            const errors = validatePassword(password, val);
            setPasswordErrorString(errors.passwordErrorString);
            setPasswordFieldsMatch(errors.passwordFieldsMatch);
          }}
          onSeedChanged={(seed: string) => {
            setRecoveryPhrase(seed);
            setRecoveryPhraseError(
              !seed ? window.i18n('recoveryPhraseEmpty') : undefined
            );
          }}
          password={password}
          passwordErrorString={passwordErrorString}
          passwordFieldsMatch={passwordFieldsMatch}
          recoveryPhrase={recoveryPhrase}
          stealAutoFocus={true}
        />
      )}

      <SignInButtons
        signInMode={signInMode}
        onRecoveryButtonClicked={() => {
          setSignInMode(SignInMode.UsingRecoveryPhrase);
          setRecoveryPhrase('');
          setDisplayName('');
        }}
        onLinkDeviceButtonClicked={() => {
          setSignInMode(SignInMode.LinkDevice);
          setRecoveryPhrase('');
          setDisplayName('');
        }}
        handleContinueYourSessionClick={() => {
          throw new Error('TODO');
        }}
      />
      {showTermsAndConditions && <TermsAndConditions />}
    </div>
  );
};
