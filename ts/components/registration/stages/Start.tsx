import { useDispatch } from 'react-redux';
import { useMount } from 'react-use';
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
import { TermsAndConditions } from '../TermsAndConditions';
import { resetRegistration } from '../utils';

export const Start = () => {
  const dispatch = useDispatch();

  useMount(() => {
    dispatch(resetOnboardingState());
    void resetRegistration();
  });

  return (
    <>
      <SessionButton
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
    </>
  );
};
