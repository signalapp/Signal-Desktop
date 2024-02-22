import { useDispatch } from 'react-redux';
import {
  setRegistrationPhase,
  setSignInMode,
  setSignUpMode,
} from '../../../state/onboarding/ducks/registration';
import { SessionIconButton } from '../../icon';
import { RegistrationPhase } from '../RegistrationStages';
import { SignInMode, SignUpMode } from '../stages';

export const BackButton = () => {
  const dispatch = useDispatch();

  return (
    <SessionIconButton
      iconSize="huge"
      iconType="arrow"
      iconPadding="5px"
      onClick={() => {
        dispatch(setRegistrationPhase(RegistrationPhase.Start));
        dispatch(setSignInMode(SignInMode.Default));
        dispatch(setSignUpMode(SignUpMode.Default));
      }}
    />
  );
};
