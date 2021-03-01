import React, { useEffect, useState } from 'react';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { SessionIdEditable } from '../SessionIdEditable';
import { signUp, validatePassword } from './RegistrationTabs';
import { RegistrationUserDetails } from './RegistrationUserDetails';
import { TermsAndConditions } from './TermsAndConditions';

export enum SignUpMode {
  Default,
  SessionIDShown,
  EnterDetails,
}

export interface Props {
  // tslint:disable: react-unused-props-and-state
  generatedRecoveryPhrase: string;
  hexGeneratedPubKey: string;
}

const CreateSessionIdButton = ({
  createSessionID,
}: {
  createSessionID: any;
}) => {
  return (
    <SessionButton
      onClick={createSessionID}
      buttonType={SessionButtonType.BrandOutline}
      buttonColor={SessionButtonColor.Green}
      text={window.i18n('createSessionID')}
    />
  );
};

const ContinueSignUpButton = ({ continueSignUp }: { continueSignUp: any }) => {
  return (
    <SessionButton
      onClick={continueSignUp}
      buttonType={SessionButtonType.Brand}
      buttonColor={SessionButtonColor.Green}
      text={window.i18n('continue')}
    />
  );
};

const SignUpDefault = (props: { createSessionID: () => void }) => {
  const allUsersAreRandomly = window.i18n('allUsersAreRandomly...');
  return (
    <div className="session-registration__content">
      <div className="session-description-long">{allUsersAreRandomly}</div>
      <CreateSessionIdButton createSessionID={props.createSessionID} />
    </div>
  );
};

const SignUpSessionIDShown = (props: { continueSignUp: () => void }) => {
  return (
    <div className="session-registration__content">
      <div className="session-registration__unique-session-id">
        {window.i18n('yourUniqueSessionID')}
      </div>

      <SessionIdEditable editable={false} placeholder={undefined} />
      <ContinueSignUpButton continueSignUp={props.continueSignUp} />
      <TermsAndConditions />
    </div>
  );
};

export const SignUpTab = (props: Props) => {
  const [signUpMode, setSignUpMode] = useState(SignUpMode.Default);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVerify, setPasswordVerify] = useState('');
  const [passwordErrorString, setPasswordErrorString] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [passwordFieldsMatch, setPasswordFieldsMatch] = useState(false);

  useEffect(() => {
    if (signUpMode === SignUpMode.SessionIDShown) {
      window.Session.setNewSessionID(props.hexGeneratedPubKey);
    }
  }, [signUpMode]);

  if (signUpMode === SignUpMode.Default) {
    return (
      <SignUpDefault
        createSessionID={() => {
          setSignUpMode(SignUpMode.SessionIDShown);
        }}
      />
    );
  }

  if (signUpMode === SignUpMode.SessionIDShown) {
    return (
      <SignUpSessionIDShown
        continueSignUp={() => {
          setSignUpMode(SignUpMode.EnterDetails);
        }}
      />
    );
  }

  // can only be the EnterDetails step

  // Display name is required
  const displayNameOK = !displayNameError && !!displayName;
  // Password is valid if empty, or if no error and fields are matching
  const passwordsOK =
    !password || (!passwordErrorString && passwordFieldsMatch);

  const enableCompleteSignUp = displayNameOK && passwordsOK;
  console.warn('handlePressEnter TODO');

  return (
    <div className="session-registration__content">
      <div className="session-registration__welcome-session">
        {window.i18n('welcomeToYourSession')}
      </div>

      <RegistrationUserDetails
        showDisplayNameField={true}
        showSeedField={false}
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
          if (!val) {
            setPasswordErrorString('');
            setPasswordFieldsMatch(true);
            setPasswordVerify('');
            return;
          }
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
        password={password}
        passwordErrorString={passwordErrorString}
        passwordFieldsMatch={passwordFieldsMatch}
        stealAutoFocus={true}
      />
      <SessionButton
        onClick={async () => {
          await signUp({
            displayName,
            generatedRecoveryPhrase: props.generatedRecoveryPhrase,
            password,
            verifyPassword: passwordVerify,
          });
        }}
        buttonType={SessionButtonType.Brand}
        buttonColor={SessionButtonColor.Green}
        text={window.i18n('getStarted')}
        disabled={!enableCompleteSignUp}
      />
      <TermsAndConditions />
    </div>
  );
};
