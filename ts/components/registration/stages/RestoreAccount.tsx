import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { NotFoundError } from '../../../session/utils/errors';
import {
  AccountRestoration,
  setAccountRestorationStep,
} from '../../../state/onboarding/ducks/registration';
import { useOnboardAccountRestorationStep } from '../../../state/onboarding/selectors/registration';
import { Flex } from '../../basic/Flex';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionIcon } from '../../icon';
import { SessionInput } from '../../inputs';
import { SessionProgressBar } from '../../loading';
import { signInAndFetchDisplayName, signInWithNewDisplayName } from '../RegistrationStages';
import { OnboardContainer, OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithininContainer } from '../components/BackButton';
import { useRecoveryProgressEffect } from '../hooks';
import { sanitizeDisplayNameOrToast } from '../utils';

export const RestoreAccount = () => {
  const step = useOnboardAccountRestorationStep();

  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryPhraseError, setRecoveryPhraseError] = useState(undefined as string | undefined);

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  const [progress, setProgress] = useState(0);

  const dispatch = useDispatch();

  useRecoveryProgressEffect({ step, progress, setProgress, displayName, dispatch });

  const recoverAndFetchDisplayName = async () => {
    setProgress(0);
    dispatch(setAccountRestorationStep(AccountRestoration.Loading));
    try {
      const displayNameFromNetwork = await signInAndFetchDisplayName({
        userRecoveryPhrase: recoveryPhrase,
        errorCallback: setRecoveryPhraseError,
      });
      setDisplayName(displayNameFromNetwork);
      dispatch(setAccountRestorationStep(AccountRestoration.Finishing));
    } catch (e) {
      if (e instanceof NotFoundError) {
        window.log.debug(
          `WIP: [continueYourSession] AccountRestoration.DisplayName failed to fetch display name so we need to enter it manually. Error: ${e}`
        );
        dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
      } else {
        dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
      }
    }
  };

  const recoverAndEnterDisplayName = async () => {
    if (!(!!displayName && !displayNameError)) {
      return;
    }

    await signInWithNewDisplayName({
      displayName,
      userRecoveryPhrase: recoveryPhrase,
    });

    dispatch(setAccountRestorationStep(AccountRestoration.Complete));
  };

  return (
    <OnboardContainer>
      {step === AccountRestoration.RecoveryPassword || step === AccountRestoration.DisplayName ? (
        <BackButtonWithininContainer margin={'2px 0 0 -36px'}>
          <Flex
            container={true}
            width="100%"
            flexDirection="column"
            justifyContent="flex-start"
            alignItems="flex-start"
            margin={'0 0 0 8px'}
          >
            {step === AccountRestoration.RecoveryPassword ? (
              <>
                <Flex container={true} width={'100%'} alignItems="center">
                  <OnboardHeading>{window.i18n('sessionRecoveryPassword')}</OnboardHeading>
                  <SessionIcon
                    iconType="recoveryPasswordOutline"
                    iconSize="large"
                    iconColor="var(--text-primary-color)"
                    style={{ margin: '-4px 0 0 8px' }}
                  />
                </Flex>
                <SpacerSM />
                <OnboardDescription>{window.i18n('onboardingRecoveryPassword')}</OnboardDescription>
                <SpacerLG />
                <SessionInput
                  autoFocus={true}
                  type="password"
                  placeholder={window.i18n('enterRecoveryPhrase')}
                  value={recoveryPhrase}
                  onValueChanged={(seed: string) => {
                    setRecoveryPhrase(seed);
                    setRecoveryPhraseError(!seed ? window.i18n('recoveryPhraseEmpty') : undefined);
                  }}
                  onEnterPressed={recoverAndFetchDisplayName}
                  error={recoveryPhraseError}
                  enableShowHide={true}
                  inputDataTestId="recovery-phrase-input"
                />
                <SpacerLG />
                <SessionButton
                  buttonColor={SessionButtonColor.White}
                  onClick={recoverAndFetchDisplayName}
                  text={window.i18n('continue')}
                  disabled={!(!!recoveryPhrase && !recoveryPhraseError)}
                  dataTestId="continue-session-button"
                />
              </>
            ) : (
              <Flex container={true} width="100%" flexDirection="column" alignItems="flex-start">
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
                  onEnterPressed={recoverAndEnterDisplayName}
                  error={displayNameError}
                  inputDataTestId="display-name-input"
                />
                <SpacerLG />
                <SessionButton
                  buttonColor={SessionButtonColor.White}
                  onClick={recoverAndEnterDisplayName}
                  text={window.i18n('continue')}
                  disabled={
                    !(
                      !!recoveryPhrase &&
                      !recoveryPhraseError &&
                      !!displayName &&
                      !displayNameError
                    )
                  }
                  dataTestId="continue-session-button"
                />
              </Flex>
            )}
          </Flex>
        </BackButtonWithininContainer>
      ) : (
        <Flex
          container={true}
          width="100%"
          flexDirection="column"
          justifyContent="flex-start"
          alignItems="center"
          margin={'0 0 0 8px'}
        >
          <SessionProgressBar
            progress={progress}
            width={'320px'}
            margin={'var(--margins-lg) auto'}
            title={window.i18n('waitOneMoment')}
            subtitle={window.i18n('loadAccountProgressMessage')}
            showPercentage={true}
          />
        </Flex>
      )}
    </OnboardContainer>
  );
};
