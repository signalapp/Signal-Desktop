import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import {
  AccountCreation,
  Onboarding,
  setAccountCreationStep,
  setOnboardingStep,
} from '../../../../state/onboarding/ducks/registration';
import {
  useOnboardAccountCreationStep,
  useOnboardGeneratedRecoveryPhrase,
  useOnboardHexGeneratedPubKey,
} from '../../../../state/onboarding/selectors/registration';
import { Flex } from '../../../basic/Flex';
import { SessionButton } from '../../../basic/SessionButton';
import { SessionIdEditable } from '../../../basic/SessionIdEditable';
import { signUp } from '../../RegistrationStages';
import { RegistrationUserDetails } from '../../RegistrationUserDetails';
import { TermsAndConditions } from '../../TermsAndConditions';
import { BackButton } from '../../components';
import { sanitizeDisplayNameOrToast } from '../restore/SignInTab';

const StyledContainer = styled.div`
  width: 100%;
  padding-top: 20px;
`;

export const SignUpTab = () => {
  const step = useOnboardAccountCreationStep();
  const generatedRecoveryPhrase = useOnboardGeneratedRecoveryPhrase();
  const hexGeneratedPubKey = useOnboardHexGeneratedPubKey();

  const dispatch = useDispatch();

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  useEffect(() => {
    if (step === AccountCreation.SessionIDShown) {
      window.Session.setNewSessionID(hexGeneratedPubKey);
    }
  }, [step, hexGeneratedPubKey]);

  if (step === AccountCreation.Start) {
    return (
      <div className="session-registration__content">
        <SessionButton
          onClick={() => {
            dispatch(setAccountCreationStep(AccountCreation.SessionIDShown));
            dispatch(setOnboardingStep(Onboarding.CreateAccount));
          }}
          text={window.i18n('createSessionID')}
        />
      </div>
    );
  }

  if (step === AccountCreation.SessionIDShown) {
    return (
      <div className="session-registration__content">
        <Flex flexDirection="row" container={true} alignItems="center">
          <BackButton />

          <div className="session-registration__unique-session-id">
            {window.i18n('yourUniqueSessionID')}
          </div>
        </Flex>
        <SessionIdEditable
          editable={false}
          placeholder={undefined}
          dataTestId="session-id-signup"
        />
        <div className="session-description-long">{window.i18n('allUsersAreRandomly...')}</div>
        <SessionButton
          onClick={() => {
            dispatch(setAccountCreationStep(AccountCreation.DisplayName));
          }}
          text={window.i18n('continue')}
        />
        <TermsAndConditions />
      </div>
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
