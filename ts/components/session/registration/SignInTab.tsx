import React, { useState } from 'react';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { signInWithRecovery, validatePassword } from './RegistrationTabs';
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
  disabled: boolean;
}) => {
  return (
    <SessionButton
      onClick={props.handleContinueYourSessionClick}
      buttonType={SessionButtonType.Brand}
      buttonColor={SessionButtonColor.Green}
      text={window.i18n('continueYourSession')}
      disabled={props.disabled}
    />
  );
};

const SignInContinueButton = (props: {
  signInMode: SignInMode;
  disabled: boolean;
  handleContinueYourSessionClick: () => any;
}) => {
  if (props.signInMode === SignInMode.Default) {
    return <></>;
  }
  return (
    <ContinueYourSessionButton
      handleContinueYourSessionClick={props.handleContinueYourSessionClick}
      disabled={props.disabled}
    />
  );
};

const SignInButtons = (props: {
  signInMode: SignInMode;
  onRecoveryButtonClicked: () => any;
  onLinkDeviceButtonClicked: () => any;
}) => {
  if (props.signInMode !== SignInMode.Default) {
    return <></>;
  }
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

  const isRecovery = signInMode === SignInMode.UsingRecoveryPhrase;
  const isLinking = signInMode === SignInMode.LinkDevice;
  const showTermsAndConditions = signInMode !== SignInMode.Default;

  // show display name input only if we are trying to recover from seed.
  // We don't need a display name when we link a device, as the display name
  // from the configuration message will be used.
  const showDisplayNameField = isRecovery;

  // Display name is required only on isRecoveryMode
  const displayNameOK =
    (isRecovery && !displayNameError && !!displayName) || isLinking;
  // Password is valid if empty, or if no error and fields are matching
  const passwordsOK =
    !password || (!passwordErrorString && passwordFieldsMatch);

  // Seed is mandatory no matter which mode
  const seedOK = recoveryPhrase && !recoveryPhraseError;

  const activateContinueButton = seedOK && displayNameOK && passwordsOK;

  return (
    <div className="session-registration__content">
      {signInMode !== SignInMode.Default && (
        <RegistrationUserDetails
          showDisplayNameField={showDisplayNameField}
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
      />
      <SignInContinueButton
        signInMode={signInMode}
        handleContinueYourSessionClick={async () => {
          if (isRecovery) {
            await signInWithRecovery({
              displayName,
              userRecoveryPhrase: recoveryPhrase,
              password,
              verifyPassword: passwordVerify,
            });
          } else if (isLinking) {
            await signInWithLinking({
              userRecoveryPhrase: recoveryPhrase,
              password,
              verifyPassword: passwordVerify,
            });
          }
        }}
        disabled={!activateContinueButton}
      />
      {showTermsAndConditions && <TermsAndConditions />}
    </div>
  );
};
