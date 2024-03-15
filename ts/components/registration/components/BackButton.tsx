import { ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
  setAccountCreationStep,
  setAccountRestorationStep,
  setOnboardingStep,
} from '../../../state/onboarding/ducks/registration';
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
  const dispatch = useDispatch();

  return (
    <SessionIconButton
      iconSize="huge"
      iconType="chevron"
      iconColor="var(--color-text-primary)"
      iconRotation={90}
      onClick={() => {
        dispatch(setOnboardingStep(Onboarding.Start));
        dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
        dispatch(setAccountCreationStep(AccountCreation.DisplayName));
        if (callback) {
          callback();
        }
      }}
    />
  );
};
