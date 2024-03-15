import { useDispatch } from 'react-redux';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
  setAccountCreationStep,
  setAccountRestorationStep,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { TermsAndConditions } from '../TermsAndConditions';
import { OnboardContainer } from '../components';

export const Start = () => {
  const dispatch = useDispatch();

  return (
    <OnboardContainer key={`onboarding-${Onboarding.Start}`} animate={true} direction="left">
      <SessionButton
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(setAccountCreationStep(AccountCreation.DisplayName));
          dispatch(setOnboardingStep(Onboarding.CreateAccount));
        }}
        text={window.i18n('onboardingAccountCreate')}
      />
      <SpacerLG />
      <SessionButton
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(setOnboardingStep(Onboarding.RestoreAccount));
          dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
        }}
        text={window.i18n('onboardingAccountExists')}
        dataTestId="restore-using-recovery"
      />
      <SpacerLG />
      <TermsAndConditions />
    </OnboardContainer>
  );
};
