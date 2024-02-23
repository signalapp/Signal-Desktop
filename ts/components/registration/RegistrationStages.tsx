import { shell } from 'electron';
import { useDispatch } from 'react-redux';
import { useMount } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { SettingsKey } from '../../data/settings-key';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { getConversationController } from '../../session/conversations';
import { mnDecode } from '../../session/crypto/mnemonic';
import { PromiseUtils, StringUtils, ToastUtils } from '../../session/utils';
import { TaskTimedOutError } from '../../session/utils/Promise';
import { fromHex } from '../../session/utils/String';
import { trigger } from '../../shims/events';
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
import { BackButton } from './components';
import { CreateAccount, RestoreAccount, Start } from './stages';

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

/**
 * Returns undefined if an error happened, or the trim userName.
 *
 * Be sure to use the trimmed userName for creating the account.
 */
const displayNameIsValid = (displayName: string): undefined | string => {
  const trimName = displayName.trim();

  if (!trimName) {
    window?.log?.warn('invalid trimmed name for registration');
    ToastUtils.pushToastError('invalidDisplayName', window.i18n('displayNameEmpty'));
    return undefined;
  }
  return trimName;
};

export async function signUp(signUpDetails: {
  displayName: string;
  generatedRecoveryPhrase: string;
}) {
  const { displayName, generatedRecoveryPhrase } = signUpDetails;
  window?.log?.info('SIGNING UP');

  const trimName = displayNameIsValid(displayName);
  // shows toast to user about the error
  if (!trimName) {
    return;
  }

  try {
    await resetRegistration();
    await registerSingleDevice(generatedRecoveryPhrase, 'english', trimName);
    await Storage.put(SettingsKey.hasSyncedInitialConfigurationItem, Date.now());
    await setSignWithRecoveryPhrase(false);
    trigger('openInbox');
  } catch (e) {
    await resetRegistration();

    ToastUtils.pushToastError('registrationError', `Error: ${e.message || 'Something went wrong'}`);
    window?.log?.warn('exception during registration:', e);
  }
}

/**
 * Sign in/restore from seed.
 * Ask for a display name, as we will drop incoming ConfigurationMessages if any are saved on the swarm.
 * We will handle a ConfigurationMessage
 */
export async function signInWithRecovery(signInDetails: {
  displayName: string;
  userRecoveryPhrase: string;
}) {
  const { displayName, userRecoveryPhrase } = signInDetails;
  window?.log?.info('RESTORING FROM SEED');
  const trimName = displayNameIsValid(displayName);
  // shows toast to user about the error
  if (!trimName) {
    return;
  }

  try {
    await resetRegistration();

    await registerSingleDevice(userRecoveryPhrase, 'english', trimName);
    await setSignWithRecoveryPhrase(true);

    trigger('openInbox');
  } catch (e) {
    await resetRegistration();
    ToastUtils.pushToastError('registrationError', `Error: ${e.message || 'Something went wrong'}`);
    window?.log?.warn('exception during registration:', e);
  }
}

/**
 * This is will try to sign in with the user recovery phrase.
 * If no ConfigurationMessage is received in 60seconds, the loading will be canceled.
 */
export async function signInWithLinking(signInDetails: { userRecoveryPhrase: string }) {
  const { userRecoveryPhrase } = signInDetails;
  window?.log?.info('LINKING DEVICE');

  try {
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
    }, 60000);
    if (displayNameFromNetwork.length) {
      // display name, avatars, groups and contacts should already be handled when this event was triggered.
      window?.log?.info(`We got a displayName from network: "${displayNameFromNetwork}"`);
    } else {
      window?.log?.info('Got a config message from network but without a displayName...');
      throw new Error('Got a config message from network but without a displayName...');
    }
    // Do not set the lastProfileUpdateTimestamp.
    // We expect to get a display name from a configuration message while we are loading messages of this user
    trigger('openInbox');
  } catch (e) {
    await resetRegistration();
    if (e instanceof TaskTimedOutError) {
      ToastUtils.pushToastError(
        'registrationError',
        'Could not find your display name. Please Sign In by Restoring Your Account instead.'
      );
    } else {
      ToastUtils.pushToastError(
        'registrationError',
        `Error: ${e.message || 'Something went wrong'}`
      );
    }
    window?.log?.warn('exception during registration:', e);
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
    <Flex container={true}>
      {step === Onboarding.Start ? null : (
        <div style={{ marginTop: 'calc(var(--margins-lg) + 30px)' }}>
          <BackButton />
        </div>
      )}
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
    </Flex>
  );
};
