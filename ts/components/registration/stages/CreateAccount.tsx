import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { SettingsKey } from '../../../data/settings-key';
import { ToastUtils } from '../../../session/utils';
import { sanitizeSessionUsername } from '../../../session/utils/String';
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
import { resetRegistration } from '../RegistrationStages';
import { OnboardContainer, OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithininContainer } from '../components/BackButton';

function sanitizeDisplayNameOrToast(
  displayName: string,
  setDisplayName: (sanitized: string) => void,
  setDisplayNameError: (error: string | undefined) => void
) {
  try {
    const sanitizedName = sanitizeSessionUsername(displayName);
    const trimName = sanitizedName.trim();
    setDisplayName(sanitizedName);
    setDisplayNameError(!trimName ? window.i18n('displayNameEmpty') : undefined);
  } catch (e) {
    setDisplayName(displayName);
    setDisplayNameError(window.i18n('displayNameErrorDescriptionShorter'));
  }
}

/**
 * Returns undefined if an error happened, or the trim userName.
 *
 * Be sure to use the trimmed userName for creating the account.
 */
export const displayNameIsValid = (displayName: string): undefined | string => {
  const trimName = displayName.trim();

  if (!trimName) {
    window?.log?.warn('invalid trimmed name for registration');
    ToastUtils.pushToastError('invalidDisplayName', window.i18n('displayNameEmpty'));
    return undefined;
  }
  return trimName;
};

async function signUp(signUpDetails: { displayName: string; generatedRecoveryPhrase: string }) {
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

export const CreateAccount = () => {
  const step = useOnboardAccountCreationStep();
  const generatedRecoveryPhrase = useOnboardGeneratedRecoveryPhrase();
  const hexGeneratedPubKey = useOnboardHexGeneratedPubKey();

  const dispatch = useDispatch();

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  useEffect(() => {
    if (step === AccountCreation.DisplayName) {
      window.Session.setNewSessionID(hexGeneratedPubKey);
    }
  }, [step, hexGeneratedPubKey]);

  const displayNameOK = !!displayName && !displayNameError;
  const signUpWithDetails = () => {
    if (!displayNameOK) {
      return;
    }

    void signUp({
      displayName,
      generatedRecoveryPhrase,
    });

    dispatch(setAccountCreationStep(AccountCreation.Done));
  };

  return (
    <OnboardContainer>
      <BackButtonWithininContainer margin={'2px 0 0 -36px'}>
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
          />
        </Flex>
      </BackButtonWithininContainer>
    </OnboardContainer>
  );
};
