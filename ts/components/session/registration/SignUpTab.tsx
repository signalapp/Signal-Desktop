import React, { useEffect, useState } from 'react';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../SessionButton';
import { SessionIdEditable } from '../SessionIdEditable';
import { RegistrationPhase, signUp } from './RegistrationTabs';
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
  setRegistrationPhase: (phase: any) => any;
}

const CreateSessionIdButton = ({ createSessionID }: { createSessionID: any }) => {
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
  return (
    <div className="session-registration__content">
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
      <div className="session-description-long">{window.i18n('signupSessionIDBlurb')}</div>
      <ContinueSignUpButton continueSignUp={props.continueSignUp} />
      <TermsAndConditions />
    </div>
  );
};

export const SignUpTab = (props: Props) => {
  const { setRegistrationPhase } = props;
  const [signUpMode, setSignUpMode] = useState(SignUpMode.Default);
  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

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
          setRegistrationPhase(RegistrationPhase.CreateSessionID)
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

  const enableCompleteSignUp = displayNameOK;
  const signUpWithDetails = async () => {
    await signUp({
      displayName,
      generatedRecoveryPhrase: props.generatedRecoveryPhrase,
    });
  };

  return (
    <div className="session-registration__content">
      <div className="session-registration__welcome-session">
        {window.i18n('welcomeToYourSession')}
      </div>

      <RegistrationUserDetails
        showDisplayNameField={true}
        showSeedField={false}
        displayName={displayName}
        handlePressEnter={signUpWithDetails}
        onDisplayNameChanged={(name: string) => {
          const sanitizedName = name.replace(window.displayNameRegex, '');
          const trimName = sanitizedName.trim();
          setDisplayName(sanitizedName);
          setDisplayNameError(!trimName ? window.i18n('displayNameEmpty') : undefined);
        }}
        stealAutoFocus={true}
      />
      <SessionButton
        onClick={signUpWithDetails}
        buttonType={SessionButtonType.Brand}
        buttonColor={SessionButtonColor.Green}
        text={window.i18n('getStarted')}
        disabled={!enableCompleteSignUp}
      />
      <TermsAndConditions />
    </div>
  );
};
