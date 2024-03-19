import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { SettingsKey } from '../../../data/settings-key';
import { trigger } from '../../../shims/events';
import {
  AccountCreation,
  setAccountCreationStep,
} from '../../../state/onboarding/ducks/registration';
import {
  useOnboardAccountCreationStep,
  useOnboardGeneratedRecoveryPhrase,
  useOnboardHexGeneratedPubKey,
} from '../../../state/onboarding/selectors/registration';
import { registerSingleDevice } from '../../../util/accountManager';
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
  const recoveryPassword = useOnboardGeneratedRecoveryPhrase();
  const hexGeneratedPubKey = useOnboardHexGeneratedPubKey();

  const dispatch = useDispatch();

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  useEffect(() => {
    if (step === AccountCreation.DisplayName) {
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
          setDisplayNameError(e.message || String(e));
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
        setDisplayNameError('');
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
          type="text"
          placeholder={window.i18n('enterDisplayName')}
          value={displayName}
          onValueChanged={(name: string) => {
            sanitizeDisplayNameOrToast(name, setDisplayName, setDisplayNameError);
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
