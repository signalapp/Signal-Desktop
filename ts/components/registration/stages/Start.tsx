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

export const Start = () => {
  const dispatch = useDispatch();

  return (
    <>
      <SessionButton
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(setAccountCreationStep(AccountCreation.DisplayName));
          dispatch(setOnboardingStep(Onboarding.CreateAccount));
        }}
        text={window.i18n('createAccount')}
      />
      <SpacerLG />
      <SessionButton
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(setOnboardingStep(Onboarding.RestoreAccount));
          dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
        }}
        text={window.i18n('restoreUsingRecoveryPhrase')}
        dataTestId="restore-using-recovery"
      />
      <SpacerLG />
      <SessionButton
        buttonColor={SessionButtonColor.White}
        onClick={() => {
          dispatch(setOnboardingStep(Onboarding.RestoreAccount));
          dispatch(setAccountRestorationStep(AccountRestoration.LinkDevice));
        }}
        text={window.i18n('linkDevice')}
        dataTestId="link-device"
      />
      <SpacerLG />
      <TermsAndConditions />
    </>
  );
};
