import { useDispatch } from 'react-redux';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
  setAccountCreationStep,
  setAccountRestorationStep,
  setDirection,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { TermsAndConditions } from '../TermsAndConditions';

export const Start = () => {
  const dispatch = useDispatch();

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
        dataTestId="restore-using-recovery"
      />
      <SpacerLG />
      <TermsAndConditions />
    </>
  );
};
