import { ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import {
  AccountRestoration,
  Onboarding,
  setAccountRestorationStep,
  setDirection,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
import {
  useOnboardAccountRestorationStep,
  useOnboardStep,
} from '../../../state/onboarding/selectors/registration';
import { Flex } from '../../basic/Flex';
import { SessionIconButton } from '../../icon';

export const BackButtonWithininContainer = ({
  children,
  margin,
  callback,
}: {
  children: ReactNode;
  margin?: string;
  callback?: () => void;
}) => {
  return (
    <Flex container={true} width={'100%'} flexDirection="row" alignItems="flex-start">
      <div style={{ margin }}>
        <BackButton callback={callback} />
      </div>
      {children}
    </Flex>
  );
};

export const BackButton = ({ callback }: { callback?: () => void }) => {
  const step = useOnboardStep();
  const restorationStep = useOnboardAccountRestorationStep();

  const dispatch = useDispatch();

  return (
    <SessionIconButton
      iconSize="huge"
      iconType="chevron"
      iconColor="var(--color-text-primary)"
      iconRotation={90}
      padding={'0'}
      onClick={() => {
        dispatch(setDirection('backward'));
        if (step === Onboarding.CreateAccount) {
          dispatch(setOnboardingStep(Onboarding.Start));
        }

        if (step === Onboarding.RestoreAccount) {
          if (restorationStep === AccountRestoration.RecoveryPassword) {
            dispatch(setOnboardingStep(Onboarding.Start));
          } else if (restorationStep === AccountRestoration.DisplayName) {
            dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
          }
        }

        if (callback) {
          callback();
        }
      }}
    />
  );
};
