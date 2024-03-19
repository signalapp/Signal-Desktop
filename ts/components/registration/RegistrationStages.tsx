import { shell } from 'electron';
import { AnimatePresence } from 'framer-motion';
import { useDispatch } from 'react-redux';
import { useMount } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { getConversationController } from '../../session/conversations';
import { mnDecode } from '../../session/crypto/mnemonic';
import { StringUtils } from '../../session/utils';
import { fromHex } from '../../session/utils/String';
import {
  Onboarding,
  setGeneratedRecoveryPhrase,
  setHexGeneratedPubKey,
} from '../../state/onboarding/ducks/registration';
import {
  useOnboardGeneratedRecoveryPhrase,
  useOnboardStep,
} from '../../state/onboarding/selectors/registration';
import { generateMnemonic, sessionGenerateKeyPair } from '../../util/accountManager';
import { Storage } from '../../util/storage';
import { Flex } from '../basic/Flex';
import { SpacerLG, SpacerSM } from '../basic/Text';
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
  const generatedRecoveryPhrase = useOnboardGeneratedRecoveryPhrase();
  const step = useOnboardStep();

  const dispatch = useDispatch();

  const generateMnemonicAndKeyPair = async () => {
    if (generatedRecoveryPhrase === '') {
      const mnemonic = await generateMnemonic();

      let seedHex = mnDecode(mnemonic);
      // handle shorter than 32 bytes seeds
      const privKeyHexLength = 32 * 2;
      if (seedHex.length !== privKeyHexLength) {
        seedHex = seedHex.concat('0'.repeat(32));
        seedHex = seedHex.substring(0, privKeyHexLength);
      }
      const seed = fromHex(seedHex);
      const keyPair = await sessionGenerateKeyPair(seed);
      const newHexPubKey = StringUtils.decode(keyPair.pubKey, 'hex');

      dispatch(setGeneratedRecoveryPhrase(mnemonic));
      dispatch(setHexGeneratedPubKey(newHexPubKey)); // our 'frontend' sessionID
    }
  };

  useMount(() => {
    void generateMnemonicAndKeyPair();
    void resetRegistration();
  });

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
              onClick={() => {
                void shell.openExternal('https://getsession.org/faq');
              }}
            />
            <SpacerSM />
            <SessionIconButton
              aria-label="external link to Session FAQ web page"
              iconType="link"
              iconSize="medium"
              iconColor="var(--text-primary-color)"
              iconPadding="4px"
              style={{ border: '2px solid var(--text-primary-color)', borderRadius: '9999px' }}
              onClick={() => {
                void shell.openExternal('https://getsession.org');
              }}
            />
          </Flex>
        </Flex>

        <Flex container={true} flexDirection="column" alignItems="center">
          <SpacerLG />
          <OnboardContainer key={'onboarding-container'} animate={true} direction="right">
            {step === Onboarding.Start ? <Start /> : null}
            {step === Onboarding.CreateAccount ? <CreateAccount /> : null}
            {step === Onboarding.RestoreAccount ? <RestoreAccount /> : null}
          </OnboardContainer>
        </Flex>
      </StyledRegistrationContainer>
    </AnimatePresence>
  );
};
