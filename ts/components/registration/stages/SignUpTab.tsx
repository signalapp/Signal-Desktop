import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { setRegistrationPhase, setSignUpMode } from '../../../state/onboarding/ducks/registration';
import {
  useRegGeneratedRecoveryPhrase,
  useRegHexGeneratedPubKey,
  useRegSignUpMode,
} from '../../../state/onboarding/selectors/registration';
import { Noop } from '../../../types/Util';
import { Flex } from '../../basic/Flex';
import { SessionButton } from '../../basic/SessionButton';
import { SessionIdEditable } from '../../basic/SessionIdEditable';
import { RegistrationPhase, signUp } from '../RegistrationStages';
import { RegistrationUserDetails } from '../RegistrationUserDetails';
import { TermsAndConditions } from '../TermsAndConditions';
import { BackButton } from '../components';
import { sanitizeDisplayNameOrToast } from './SignInTab';

const StyledContainer = styled.div`
  width: 100%;
  padding-top: 20px;
`;

export enum SignUpMode {
  Default,
  SessionIDShown,
  EnterDetails,
}

const CreateSessionIdButton = ({ createSessionID }: { createSessionID: any }) => {
  return <SessionButton onClick={createSessionID} text={window.i18n('createSessionID')} />;
};

const ContinueSignUpButton = ({ continueSignUp }: { continueSignUp: any }) => {
  return <SessionButton onClick={continueSignUp} text={window.i18n('continue')} />;
};

const SignUpDefault = (props: { createSessionID: Noop }) => {
  return (
    <div className="session-registration__content">
      <CreateSessionIdButton createSessionID={props.createSessionID} />
    </div>
  );
};

const SignUpSessionIDShown = (props: { continueSignUp: Noop }) => {
  return (
    <div className="session-registration__content">
      <Flex flexDirection="row" container={true} alignItems="center">
        <BackButton />

        <div className="session-registration__unique-session-id">
          {window.i18n('yourUniqueSessionID')}
        </div>
      </Flex>
      <SessionIdEditable editable={false} placeholder={undefined} dataTestId="session-id-signup" />
      <div className="session-description-long">{window.i18n('allUsersAreRandomly...')}</div>
      <ContinueSignUpButton continueSignUp={props.continueSignUp} />
      <TermsAndConditions />
    </div>
  );
};

export const SignUpTab = () => {
  const signUpMode = useRegSignUpMode();
  const generatedRecoveryPhrase = useRegGeneratedRecoveryPhrase();
  const hexGeneratedPubKey = useRegHexGeneratedPubKey();

  const dispatch = useDispatch();

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  useEffect(() => {
    if (signUpMode === SignUpMode.SessionIDShown) {
      window.Session.setNewSessionID(hexGeneratedPubKey);
    }
  }, [signUpMode, hexGeneratedPubKey]);

  if (signUpMode === SignUpMode.Default) {
    return (
      <SignUpDefault
        createSessionID={() => {
          dispatch(setSignUpMode(SignUpMode.SessionIDShown));
          dispatch(setRegistrationPhase(RegistrationPhase.SignUp));
        }}
      />
    );
  }

  if (signUpMode === SignUpMode.SessionIDShown) {
    return (
      <SignUpSessionIDShown
        continueSignUp={() => {
          dispatch(setSignUpMode(SignUpMode.EnterDetails));
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
      generatedRecoveryPhrase,
    });
  };

  return (
    <StyledContainer>
      <Flex flexDirection="row" container={true} alignItems="center">
        <BackButton />
        <Flex className="session-registration__welcome-session" padding="20px">
          {window.i18n('welcomeToYourSession')}
        </Flex>
      </Flex>
      <RegistrationUserDetails
        showDisplayNameField={true}
        showSeedField={false}
        displayName={displayName}
        handlePressEnter={signUpWithDetails}
        onDisplayNameChanged={(name: string) => {
          sanitizeDisplayNameOrToast(name, setDisplayName, setDisplayNameError);
        }}
        stealAutoFocus={true}
      />
      <SessionButton
        onClick={signUpWithDetails}
        text={window.i18n('getStarted')}
        disabled={!enableCompleteSignUp}
      />
      <TermsAndConditions />
    </StyledContainer>
  );
};
