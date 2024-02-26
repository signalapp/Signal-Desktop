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
}: {
  children: ReactNode;
  margin?: string;
}) => {
  return (
    <Flex container={true} width={'100%'} flexDirection="row" alignItems="flex-start">
      <div style={{ margin }}>
        <BackButton />
      </div>
      {children}
    </Flex>
  );
};

export const BackButton = () => {
  const dispatch = useDispatch();

  return (
    <SessionIconButton
      iconSize="huge"
      iconType="chevron"
      iconColor="var(--color-text-primary)"
      iconRotation={90}
      iconPadding="5px"
      onClick={() => {
        dispatch(setOnboardingStep(Onboarding.Start));
        dispatch(setAccountRestorationStep(AccountRestoration.Start));
        dispatch(setAccountCreationStep(AccountCreation.DisplayName));
      }}
    />
  );
};
