import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import { SettingsKey } from '../../../data/settings-key';
import { mnDecode } from '../../../session/crypto/mnemonic';
import { ProfileManager } from '../../../session/profile_manager/ProfileManager';
import { StringUtils } from '../../../session/utils';
import { fromHex } from '../../../session/utils/String';
import { trigger } from '../../../shims/events';
import {
  AccountCreation,
  setAccountCreationStep,
  setDisplayName,
  setDisplayNameError,
  setHexGeneratedPubKey,
  setPrivateKeyBytes,
  setRecoveryPassword,
} from '../../../state/onboarding/ducks/registration';
import {
  useDisplayName,
  useDisplayNameError,
  useOnboardPrivateKeyBytes,
  useRecoveryPassword,
} from '../../../state/onboarding/selectors/registration';
import {
  generateMnemonic,
  registerSingleDevice,
  sessionGenerateKeyPair,
} from '../../../util/accountManager';
import { Storage, setSignWithRecoveryPhrase } from '../../../util/storage';
import { UserConfigWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionInput } from '../../inputs';
import { resetRegistration } from '../RegistrationStages';
import { ContinueButton, OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithinContainer } from '../components/BackButton';
import { displayNameIsValid, sanitizeDisplayNameOrToast } from '../utils';

export type AccountDetails = {
  recoveryPassword: string;
  displayName?: string;
};

async function signUp(signUpDetails: AccountDetails) {
  const { displayName, recoveryPassword } = signUpDetails;

  try {
    const validDisplayName = displayNameIsValid(displayName);
    await resetRegistration();
    await registerSingleDevice(recoveryPassword, 'english', validDisplayName);
    await Storage.put(SettingsKey.hasSyncedInitialConfigurationItem, Date.now());
    await setSignWithRecoveryPhrase(false);
    trigger('openInbox');
  } catch (e) {
    await resetRegistration();
    throw e;
  }
}

export const CreateAccount = () => {
  const privateKeyBytes = useOnboardPrivateKeyBytes();
  const recoveryPassword = useRecoveryPassword();
  const displayName = useDisplayName();
  const displayNameError = useDisplayNameError();

  const dispatch = useDispatch();

  const generateMnemonicAndKeyPair = async () => {
    if (recoveryPassword === '') {
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

      dispatch(setRecoveryPassword(mnemonic));
      dispatch(setPrivateKeyBytes(keyPair.ed25519KeyPair.privateKey));
      dispatch(setHexGeneratedPubKey(newHexPubKey)); // our 'frontend' account ID
    }
  };

  useMount(() => {
    void generateMnemonicAndKeyPair();
  });

  const signUpWithDetails = async () => {
    if (isEmpty(displayName) || !isEmpty(displayNameError)) {
      return;
    }

    try {
      if (!privateKeyBytes) {
        throw new Error('Private key not found');
      }
      // validate display name using libsession
      // eslint-disable-next-line max-len
      // TODO [libsession validation] if we try and use a different display name after entering one that is already too long we get an error because the user config has been initialised. I call .free() in the finally but that doesn't help
      await UserConfigWrapperActions.init(privateKeyBytes, null);

      const validName = await ProfileManager.updateOurProfileDisplayName(displayName, true);

      await signUp({
        displayName: validName,
        recoveryPassword,
      });

      dispatch(setAccountCreationStep(AccountCreation.Done));
    } catch (err) {
      let errorString = err.message || String(err);
      // Note error substring is taken from libsession-util
      if (err.message && err.message.includes('exceeds maximum length')) {
        errorString = window.i18n('displayNameTooLong');
      }
      window.log.error(
        `[onboarding] create account: signUpWithDetails failed! Error: ${errorString}`
      );
      dispatch(setAccountCreationStep(AccountCreation.DisplayName));
      dispatch(setDisplayNameError(errorString));
    } finally {
      await UserConfigWrapperActions.free();
    }
  };

  return (
    <BackButtonWithinContainer
      margin={'2px 0 0 -36px'}
      shouldQuit={true}
      quitMessage={window.i18n('onboardingBackAccountCreation')}
      callback={() => {
        dispatch(setDisplayName(''));
        dispatch(setRecoveryPassword(''));
        dispatch(setDisplayNameError(undefined));
      }}
    >
      <Flex
        container={true}
        width="100%"
        flexDirection="column"
        alignItems="flex-start"
        margin={'0 0 0 8px'}
      >
        <OnboardHeading>{window.i18n('displayNamePick')}</OnboardHeading>
        <SpacerSM />
        <OnboardDescription>{window.i18n('displayNameDescription')}</OnboardDescription>
        <SpacerLG />
        <SessionInput
          ariaLabel={window.i18n('enterDisplayName')}
          autoFocus={true}
          disableOnBlurEvent={true}
          type="text"
          placeholder={window.i18n('enterDisplayName')}
          value={displayName}
          onValueChanged={(name: string) => {
            const sanitizedName = sanitizeDisplayNameOrToast(name, setDisplayNameError, dispatch);
            dispatch(setDisplayName(sanitizedName));
          }}
          onEnterPressed={signUpWithDetails}
          error={displayNameError}
          inputDataTestId="display-name-input"
        />
        <SpacerLG />
        <ContinueButton
          onClick={signUpWithDetails}
          disabled={isEmpty(displayName) || !isEmpty(displayNameError)}
        />
      </Flex>
    </BackButtonWithinContainer>
  );
};
