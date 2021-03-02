import React, { useState } from 'react';
import { Flex } from '../Flex';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { SessionSpinner } from '../SessionSpinner';
import {
  signInWithLinking,
  signInWithRecovery,
  validatePassword,
} from './RegistrationTabs';
import { RegistrationUserDetails } from './RegistrationUserDetails';
import { TermsAndConditions } from './TermsAndConditions';

export enum SignInMode {
  Default,
  UsingRecoveryPhrase,
  LinkDevice,
}
// tslint:disable: use-simple-attributes
// tslint:disable: react-unused-props-and-state

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
      <div className="spacer-lg" />
      <div className="or">{window.i18n('or')}</div>
      <div className="spacer-lg" />
      <LinkDeviceButton
        onLinkDeviceButtonClicked={props.onLinkDeviceButtonClicked}
      />
    </div>
  );
};

export const SignInTab = () => {
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
  const [loading, setIsLoading] = useState(false);

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

  const activateContinueButton =
    seedOK && displayNameOK && passwordsOK && !loading;

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
          setIsLoading(false);
        }}
        onLinkDeviceButtonClicked={() => {
          setSignInMode(SignInMode.LinkDevice);
          setRecoveryPhrase('');
          setDisplayName('');
          setIsLoading(false);
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
            setIsLoading(true);
            await signInWithLinking({
              userRecoveryPhrase: recoveryPhrase,
              password,
              verifyPassword: passwordVerify,
            });
            setIsLoading(false);
          }
        }}
        disabled={!activateContinueButton}
      />
      <Flex container={true} justifyContent="center">
        <SessionSpinner loading={loading} />
      </Flex>
      {showTermsAndConditions && <TermsAndConditions />}
    </div>
  );
};
