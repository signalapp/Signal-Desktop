import { shell } from 'electron';
import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { getConversationController } from '../../session/conversations';
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
import { Storage } from '../../util/storage';
import { Flex } from '../basic/Flex';
import { SpacerSM, SpacerXL, SpacerXS } from '../basic/Text';
import { SessionIcon, SessionIconButton } from '../icon';
import { OnboardContainer } from './components';
import { CreateAccount, RestoreAccount, Start } from './stages';

export async function resetRegistration() {
  await Data.removeAll();
  Storage.reset();
  await Storage.fetch();
  getConversationController().reset();
  await getConversationController().load();
}

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
        <Flex container={true} alignItems="center" height={'30px'}>
          <SessionIcon iconColor="var(--primary-color)" iconSize={'huge'} iconType="brand" />
          <SpacerXS />
          <div style={{ flexGrow: 1, zIndex: -1 }}>
            <SessionIcon iconSize={140} iconType="session" iconColor="var(--text-primary-color)" />
          </div>
          <Flex container={true} alignItems="center">
            <SessionIconButton
              ariaLabel="FAQ Link"
              iconType="question"
              iconSize={'medium'}
              iconPadding="4px"
              iconColor="var(--text-primary-color)"
              padding={'0'}
              style={{ border: '2px solid var(--text-primary-color)', borderRadius: '9999px' }}
              dataTestId="session-faq-link"
              onClick={() => {
                void shell.openExternal('https://getsession.org/faq');
              }}
            />
            <SpacerSM />
            <SessionIconButton
              ariaLabel="Session website link"
              iconType="link"
              iconSize="medium"
              iconColor="var(--text-primary-color)"
              iconPadding="4px"
              padding={'0'}
              style={{ border: '2px solid var(--text-primary-color)', borderRadius: '9999px' }}
              dataTestId="session-website-link"
              onClick={() => {
                void shell.openExternal('https://getsession.org');
              }}
            />
          </Flex>
        </Flex>

        <Flex container={true} flexDirection="column" alignItems="center">
          <SpacerXL />
          <OnboardContainer
            key={`${Onboarding[step]}-${step === Onboarding.CreateAccount ? AccountCreation[creationStep] : AccountRestoration[restorationStep]}`}
            animate={
              step !== Onboarding.Start &&
              restorationStep !== AccountRestoration.Finishing &&
              restorationStep !== AccountRestoration.Finished &&
              restorationStep !== AccountRestoration.Complete
            }
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
