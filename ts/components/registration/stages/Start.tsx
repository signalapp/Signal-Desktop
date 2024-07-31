import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import styled from 'styled-components';
import { sleepFor } from '../../../session/utils/Promise';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
  resetOnboardingState,
  setAccountCreationStep,
  setAccountRestorationStep,
  setDirection,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { resetRegistration } from '../RegistrationStages';
import { TermsAndConditions } from '../TermsAndConditions';

// NOTE we want to prevent the buttons from flashing when the app starts
const StyledStart = styled.div<{ ready: boolean }>`
  ${props =>
    !props.ready &&
    `.session-button {
    transition: none;
  }`}
`;

export const Start = () => {
  const [ready, setReady] = useState(false);

  const dispatch = useDispatch();

  useMount(() => {
    dispatch(resetOnboardingState());
    void resetRegistration();

    // eslint-disable-next-line more/no-then
    void sleepFor(500).then(() => setReady(true));
  });

  return (
    <StyledStart ready={ready}>
      <SessionButton
        ariaLabel={'Create account button'}
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(setDirection('forward'));
          dispatch(setAccountCreationStep(AccountCreation.DisplayName));
          dispatch(setOnboardingStep(Onboarding.CreateAccount));
        }}
        text={window.i18n('onboardingAccountCreate')}
        dataTestId="create-account-button"
      />
      <SpacerLG />
      <SessionButton
        ariaLabel={'Restore account button'}
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(setDirection('forward'));
          dispatch(setOnboardingStep(Onboarding.RestoreAccount));
          dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
        }}
        text={window.i18n('onboardingAccountExists')}
        dataTestId="existing-account-button"
      />
      <SpacerLG />
      <TermsAndConditions />
    </StyledStart>
  );
};
