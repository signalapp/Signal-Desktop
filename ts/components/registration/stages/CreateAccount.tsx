import { useDispatch } from 'react-redux';
import { useMount } from 'react-use';
import { SettingsKey } from '../../../data/settings-key';
import { mnDecode } from '../../../session/crypto/mnemonic';
import { StringUtils } from '../../../session/utils';
import { fromHex } from '../../../session/utils/String';
import { trigger } from '../../../shims/events';
import {
  AccountCreation,
  setAccountCreationStep,
  setDisplayName,
  setDisplayNameError,
  setHexGeneratedPubKey,
  setRecoveryPassword,
} from '../../../state/onboarding/ducks/registration';
import {
  useDisplayName,
  useDisplayNameError,
  useRecoveryPassword,
} from '../../../state/onboarding/selectors/registration';
import {
  generateMnemonic,
  registerSingleDevice,
  sessionGenerateKeyPair,
} from '../../../util/accountManager';
import { Storage, setSignWithRecoveryPhrase } from '../../../util/storage';
import { Flex } from '../../basic/Flex';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionInput } from '../../inputs';
import { OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithininContainer } from '../components/BackButton';
import { displayNameIsValid, resetRegistration, sanitizeDisplayNameOrToast } from '../utils';

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
      dispatch(setHexGeneratedPubKey(newHexPubKey)); // our 'frontend' account ID
    }
  };

  useMount(() => {
    void generateMnemonicAndKeyPair();
  });

  const signUpWithDetails = async () => {
    if (!(!!displayName && !displayNameError)) {
      return;
    }

    try {
      window.log.debug(
        `WIP: [onboarding] create account: signUp() is starting display name: ${displayName} recoveryPassword: ${recoveryPassword}`
      );
      await signUp({
        displayName,
        recoveryPassword,
      });

      dispatch(setAccountCreationStep(AccountCreation.Done));
    } catch (e) {
      window.log.debug(
        `WIP: [onboarding] create account: creation failed! Error: ${e.message || e}`
      );
      dispatch(setDisplayNameError(e.message || String(e)));
      dispatch(setAccountCreationStep(AccountCreation.DisplayName));
    }
  };

  return (
    <BackButtonWithininContainer
      margin={'2px 0 0 -36px'}
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
          autoFocus={true}
          disabledOnBlur={true}
          type="text"
          placeholder={window.i18n('enterDisplayName')}
          value={displayName}
          onValueChanged={(_name: string) => {
            const name = sanitizeDisplayNameOrToast(_name, setDisplayNameError, dispatch);
            dispatch(setDisplayName(name));
          }}
          onEnterPressed={signUpWithDetails}
          error={displayNameError}
          inputDataTestId="display-name-input"
        />
        <SpacerLG />
        <SessionButton
          buttonColor={SessionButtonColor.White}
          onClick={signUpWithDetails}
          text={window.i18n('continue')}
          disabled={!(!!displayName && !displayNameError)}
          dataTestId="continue-button"
        />
      </Flex>
    </BackButtonWithininContainer>
  );
};
