import { useDispatch } from 'react-redux';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
  setAccountCreationStep,
  setAccountRestorationStep,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
import { SessionIconButton } from '../../icon';

export const BackButton = () => {
  const dispatch = useDispatch();

  return (
    <SessionIconButton
      iconSize="huge"
      iconType="arrow"
      iconPadding="5px"
      onClick={() => {
        dispatch(setOnboardingStep(Onboarding.Start));
        dispatch(setAccountRestorationStep(AccountRestoration.Start));
        dispatch(setAccountCreationStep(AccountCreation.Start));
      }}
    />
  );
};
