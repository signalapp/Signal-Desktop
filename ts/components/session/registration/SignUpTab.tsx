import React from 'react';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { SessionIdEditable } from '../SessionIdEditable';
import { RegistrationUserDetails } from './RegistrationUserDetails';
import { TermsAndConditions } from './TermsAndConditions';

export enum SignUpMode {
  Default,
  SessionIDShown,
  EnterDetails,
}

export interface Props {
  // tslint:disable: react-unused-props-and-state
  signUpMode: SignUpMode;
  continueSignUp: () => any;
  createSessionID: () => any;
  onCompleteSignUpClick: () => any;
  passwordErrorString: string;
  passwordFieldsMatch: boolean;
  displayNameError?: string;
  displayName: string;
  password: string;
  recoveryPhrase: string;
  stealAutoFocus?: boolean;
  handlePressEnter: () => any;
  onSeedChanged: (val: string) => any;
  onDisplayNameChanged: (val: string) => any;
  onPasswordChanged: (val: string) => any;
  onPasswordVerifyChanged: (val: string) => any;
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

export const SignUpTab = (props: Props) => {
  const { signUpMode, continueSignUp, createSessionID } = props;

  switch (signUpMode) {
    case SignUpMode.Default:
      const allUsersAreRandomly = window.i18n('allUsersAreRandomly...');

      return (
        <div className="session-registration__content">
          <div className="session-description-long">{allUsersAreRandomly}</div>
          <CreateSessionIdButton createSessionID={createSessionID} />
        </div>
      );

    case SignUpMode.SessionIDShown:
      return (
        <div className="session-registration__content">
          <div className="session-registration__unique-session-id">
            {window.i18n('yourUniqueSessionID')}
          </div>

          <SessionIdEditable editable={false} placeholder={undefined} />
          <ContinueSignUpButton continueSignUp={continueSignUp} />
          <TermsAndConditions />
        </div>
      );

    // can only be the EnterDetails step
    default:
      const {
        passwordErrorString,
        passwordFieldsMatch,
        displayNameError,
        displayName,
        password,
      } = props;

      let enableCompleteSignUp = true;
      const displayNameOK = !displayNameError && !!displayName; //display name required
      const passwordsOK =
        !password || (!passwordErrorString && passwordFieldsMatch); // password is valid if empty, or if no error and fields are matching

      enableCompleteSignUp = displayNameOK && passwordsOK;

      return (
        <div className="session-registration__content">
          <div className="session-registration__welcome-session">
            {window.i18n('welcomeToYourSession')}
          </div>

          <RegistrationUserDetails
            showDisplayNameField={true}
            showSeedField={false}
            displayName={props.displayName}
            handlePressEnter={props.handlePressEnter}
            onDisplayNameChanged={props.onDisplayNameChanged}
            onPasswordChanged={props.onPasswordChanged}
            onPasswordVerifyChanged={props.onPasswordVerifyChanged}
            onSeedChanged={props.onSeedChanged}
            password={props.password}
            passwordErrorString={props.passwordErrorString}
            passwordFieldsMatch={props.passwordFieldsMatch}
            recoveryPhrase={props.recoveryPhrase}
            stealAutoFocus={true}
          />
          <SessionButton
            onClick={props.onCompleteSignUpClick}
            buttonType={SessionButtonType.Brand}
            buttonColor={SessionButtonColor.Green}
            text={window.i18n('getStarted')}
            disabled={!enableCompleteSignUp}
          />
          <TermsAndConditions />
        </div>
      );
  }
};
