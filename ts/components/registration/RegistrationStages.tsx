import { shell } from 'electron';
import { useDispatch } from 'react-redux';
import { useMount } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { ONBOARDING_TIMES } from '../../session/constants';
import { getConversationController } from '../../session/conversations';
import { InvalidWordsError, NotEnoughWordsError, mnDecode } from '../../session/crypto/mnemonic';
import { PromiseUtils, StringUtils, ToastUtils } from '../../session/utils';
import { fromHex } from '../../session/utils/String';
import { NotFoundError } from '../../session/utils/errors';
import {
  Onboarding,
  setGeneratedRecoveryPhrase,
  setHexGeneratedPubKey,
} from '../../state/onboarding/ducks/registration';
import {
  useOnboardGeneratedRecoveryPhrase,
  useOnboardStep,
} from '../../state/onboarding/selectors/registration';
import {
  generateMnemonic,
  registerSingleDevice,
  sessionGenerateKeyPair,
  signInByLinkingDevice,
} from '../../util/accountManager';
import { Storage, setSignInByLinking, setSignWithRecoveryPhrase } from '../../util/storage';
import { Flex } from '../basic/Flex';
import { SpacerLG, SpacerSM } from '../basic/Text';
import { SessionIcon, SessionIconButton } from '../icon';
import { CreateAccount, RestoreAccount, Start } from './stages';
import { displayNameIsValid } from './utils';

const StyledRegistrationContainer = styled(Flex)`
  width: 348px;

  .session-button {
    width: 100%;
    margin: 0;
  }
`;

export async function resetRegistration() {
  await Data.removeAll();
  Storage.reset();
  await Storage.fetch();
  getConversationController().reset();
  await getConversationController().load();
}

type SignInDetails = {
  userRecoveryPhrase: string;
  displayName?: string;
  errorCallback?: (error: string) => void;
};

/**
 * Sign in/restore from seed.
 * Ask for a display name, as we will drop incoming ConfigurationMessages if any are saved on the swarm.
 * We will handle a ConfigurationMessage
 */
export async function signInWithNewDisplayName(signInDetails: SignInDetails) {
  const { displayName, userRecoveryPhrase } = signInDetails;
  window.log.debug(`WIP: [signInWithNewDisplayName] starting sign in with new display name....`);
  const trimName = displayName ? displayNameIsValid(displayName) : undefined;
  if (!trimName) {
    return;
  }

  try {
    await resetRegistration();
    await registerSingleDevice(userRecoveryPhrase, 'english', trimName);
    await setSignWithRecoveryPhrase(true);
  } catch (e) {
    await resetRegistration();
    ToastUtils.pushToastError('registrationError', `Error: ${e.message || 'Something went wrong'}`);
    window?.log?.warn('exception during registration:', e);
  }
}

/**
 * This will try to sign in with the user recovery phrase.
 * If no ConfigurationMessage is received within ONBOARDING_RECOVERY_TIMEOUT, the user will be asked to enter a display name.
 */
export async function signInAndFetchDisplayName(signInDetails: SignInDetails) {
  const { userRecoveryPhrase, errorCallback } = signInDetails;
  window.log.debug(`WIP: [signInAndFetchDisplayName] starting sign in....`);

  try {
    throw new NotFoundError('Got a config message from network but without a displayName...');
    await resetRegistration();
    await signInByLinkingDevice(userRecoveryPhrase, 'english');
    let displayNameFromNetwork = '';
    await getSwarmPollingInstance().start();

    await PromiseUtils.waitForTask(done => {
      window.Whisper.events.on('configurationMessageReceived', async (displayName: string) => {
        window.Whisper.events.off('configurationMessageReceived');
        await setSignInByLinking(false);
        await setSignWithRecoveryPhrase(true);
        done(displayName);
        displayNameFromNetwork = displayName;
      });
    }, ONBOARDING_TIMES.RECOVERY_TIMEOUT);
    if (displayNameFromNetwork.length) {
      // display name, avatars, groups and contacts should already be handled when this event was triggered.
      window.log.debug(
        `WIP: [signInAndFetchDisplayName] we got a displayName from network: "${displayNameFromNetwork}"`
      );
    } else {
      window.log.debug(
        `WIP: [signInAndFetchDisplayName] Got a config message from network but without a displayName...`
      );
      throw new NotFoundError('Got a config message from network but without a displayName...');
    }
    // Do not set the lastProfileUpdateTimestamp.
    // We expect to get a display name from a configuration message while we are loading messages of this user
    return displayNameFromNetwork;
  } catch (e) {
    await resetRegistration();
    if (errorCallback) {
      if (e instanceof NotEnoughWordsError) {
        void errorCallback(window.i18n('recoveryPasswordErrorMessageShort'));
      } else if (e instanceof InvalidWordsError) {
        void errorCallback(window.i18n('recoveryPasswordErrorMessageIncorrect'));
      } else {
        void errorCallback(window.i18n('recoveryPasswordErrorMessageGeneric'));
      }
    }
    window.log.debug(
      `WIP: [signInAndFetchDisplayName] exception during registration: ${e.message || e}`
    );
    return '';
  }
}

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
        {step === Onboarding.Start ? <Start /> : null}
        {step === Onboarding.CreateAccount ? <CreateAccount /> : null}
        {step === Onboarding.RestoreAccount ? <RestoreAccount /> : null}
      </Flex>
    </StyledRegistrationContainer>
  );
};
