import { shell } from 'electron';
import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
} from '../../state/onboarding/ducks/registration';
import {
  useOnboardAccountCreationStep,
  useOnboardAccountRestorationStep,
  useOnboardStep,
} from '../../state/onboarding/selectors/registration';
import { Flex } from '../basic/Flex';
import { SpacerLG, SpacerSM } from '../basic/Text';
import { SessionIcon, SessionIconButton } from '../icon';
import { OnboardContainer } from './components';
import { CreateAccount, RestoreAccount, Start } from './stages';

export type RecoverDetails = {
  recoveryPassword: string;
  errorCallback: (error: Error) => void;
  displayName?: string;
};

const StyledRegistrationContainer = styled(Flex)`
  width: 348px;
  .session-button {
    width: 100%;
    margin: 0;
  }
`;

export const RegistrationStages = () => {
  const step = useOnboardStep();
  const creationStep = useOnboardAccountCreationStep();
  const restorationStep = useOnboardAccountRestorationStep();

  return (
    <AnimatePresence>
      <StyledRegistrationContainer container={true} flexDirection="column">
        <Flex container={true} alignItems="center">
          <SessionIcon iconColor="var(--primary-color)" iconSize={'huge'} iconType="brand" />
          <SpacerSM />
          <div style={{ flexGrow: 1 }}>
            <SessionIcon iconSize={'small'} iconType="session" />
          </div>
          <Flex container={true} alignItems="center">
            <SessionIconButton
              aria-label="external link to Session FAQ web page"
              iconType="question"
              iconSize={'medium'}
              iconPadding="4px"
              iconColor="var(--text-primary-color)"
              style={{ border: '2px solid var(--text-primary-color)', borderRadius: '9999px' }}
              dataTestId="session-faq-link"
              onClick={() => {
                void shell.openExternal('https://getsession.org/faq');
              }}
            />
            <SpacerSM />
            <SessionIconButton
              aria-label="external link to Session website"
              iconType="link"
              iconSize="medium"
              iconColor="var(--text-primary-color)"
              iconPadding="4px"
              style={{ border: '2px solid var(--text-primary-color)', borderRadius: '9999px' }}
              dataTestId="session-website-link"
              onClick={() => {
                void shell.openExternal('https://getsession.org');
              }}
            />
          </Flex>
        </Flex>

        <Flex container={true} flexDirection="column" alignItems="center">
          <SpacerLG />
          <OnboardContainer
            key={`${Onboarding[step]}-${step === Onboarding.CreateAccount ? AccountCreation[creationStep] : AccountRestoration[restorationStep]}`}
            animate={step !== Onboarding.Start}
          >
            {step === Onboarding.Start ? <Start /> : null}
            {step === Onboarding.CreateAccount ? <CreateAccount /> : null}
            {step === Onboarding.RestoreAccount ? <RestoreAccount /> : null}
          </OnboardContainer>
        </Flex>
      </StyledRegistrationContainer>
    </AnimatePresence>
  );
};
