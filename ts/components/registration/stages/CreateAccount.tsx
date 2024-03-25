import { useEffect } from 'react';
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
  useOnboardAccountCreationStep,
  useOnboardHexGeneratedPubKey,
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
import { RecoverDetails, resetRegistration } from '../RegistrationStages';
import { OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithininContainer } from '../components/BackButton';
import { displayNameIsValid, sanitizeDisplayNameOrToast } from '../utils';

async function signUp(signUpDetails: RecoverDetails) {
  const { displayName, recoveryPassword, errorCallback } = signUpDetails;
  window.log.debug(`WIP: [signUp] starting sign up....`);

  try {
    const trimName = displayNameIsValid(displayName);

    await resetRegistration();
    await registerSingleDevice(recoveryPassword, 'english', trimName);
    await Storage.put(SettingsKey.hasSyncedInitialConfigurationItem, Date.now());
    await setSignWithRecoveryPhrase(false);
    trigger('openInbox');
  } catch (e) {
    await resetRegistration();
    void errorCallback(e);
    window.log.debug(`WIP: [signUp] exception during registration: ${e.message || e}`);
  }
}

export const CreateAccount = () => {
  const step = useOnboardAccountCreationStep();
  const recoveryPassword = useRecoveryPassword();
  const hexGeneratedPubKey = useOnboardHexGeneratedPubKey();
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
      dispatch(setHexGeneratedPubKey(newHexPubKey)); // our 'frontend' sessionID
    }
  };

  useMount(() => {
    void generateMnemonicAndKeyPair();
  });

  useEffect(() => {
    if (step === AccountCreation.DisplayName && hexGeneratedPubKey) {
      window.Session.setNewSessionID(hexGeneratedPubKey);
    }
  }, [step, hexGeneratedPubKey]);

  const signUpWithDetails = async () => {
    if (!(!!displayName && !displayNameError)) {
      return;
    }

    try {
      await signUp({
        displayName,
        recoveryPassword,
        errorCallback: e => {
          dispatch(setDisplayNameError(e.message || String(e)));
          throw e;
        },
      });

      dispatch(setAccountCreationStep(AccountCreation.Done));
    } catch (e) {
      window.log.debug(
        `WIP: [recoverAndFetchDisplayName] AccountRestoration.RecoveryPassword failed to fetch display name so we need to enter it manually. Error: ${e}`
      );
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
        />
      </Flex>
    </BackButtonWithininContainer>
  );
};
