import { isEmpty } from 'lodash';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ONBOARDING_TIMES } from '../../../session/constants';
import { NotFoundError } from '../../../session/utils/errors';
import { trigger } from '../../../shims/events';
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
import { sanitizeDisplayNameOrToast } from '../utils';

export const RestoreAccount = () => {
  const step = useOnboardAccountRestorationStep();

  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryPhraseError, setRecoveryPhraseError] = useState(undefined as string | undefined);

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<undefined | string>('');

  const [progress, setProgress] = useState(0);

  const dispatch = useDispatch();

  // Seed is mandatory no matter which mode
  const seedOK = !!recoveryPhrase && !recoveryPhraseError;
  const displayNameOK = !!displayName && !displayNameError;

  const activateContinueButton =
    seedOK &&
    !(
      step ===
      (AccountRestoration.Loading || AccountRestoration.Finishing || AccountRestoration.Finished)
    );

  const recoverWithoutDisplayName = async () => {
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
          `WIP: [continueYourSession] AccountRestoration.DisplayName failed to fetch display name so we need to enter it manually error ${e.message ||
            e}`
        );
        dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
      } else {
        dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
      }
    }
  };

  const recoverWithDisplayName = async () => {
    if (!displayNameOK) {
      return;
    }

    void signInWithNewDisplayName({
      displayName,
      userRecoveryPhrase: recoveryPhrase,
    });

    dispatch(setAccountRestorationStep(AccountRestoration.Complete));
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (step === AccountRestoration.Loading) {
      interval = setInterval(() => {
        if (progress < 100) {
          setProgress(progress + 1);
        }
        window.log.debug(
          `WIP: [continueYourSession] AccountRestoration.Loading Loading progress ${progress}%`
        );

        if (progress >= 100) {
          clearInterval(interval);
          // if we didn't get the display name in time, we need to enter it manually
          window.log.debug(
            `WIP: [continueYourSession] AccountRestoration.Loading We didn't get the display name in time, we need to enter it manually`
          );
          dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
        }
      }, ONBOARDING_TIMES.RECOVERY_TIMEOUT / 100);
    }

    if (step === AccountRestoration.Finishing) {
      interval = setInterval(() => {
        if (progress < 100) {
          setProgress(progress + 1);
        }
        window.log.debug(
          `WIP: [continueYourSession] AccountRestoration. Finishing progress ${progress}%`
        );

        if (progress >= 100) {
          clearInterval(interval);
          dispatch(setAccountRestorationStep(AccountRestoration.Finished));
        }
      }, ONBOARDING_TIMES.RECOVERY_FINISHING / 100);
    }

    if (step === AccountRestoration.Finished) {
      interval = setInterval(() => {
        clearInterval(interval);
        if (!isEmpty(displayName)) {
          window.log.debug(
            `WIP: [continueYourSession] AccountRestoration.Complete Finished progress`
          );
          dispatch(setAccountRestorationStep(AccountRestoration.Complete));
        } else {
          dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
          window.log.debug(
            `WIP: [continueYourSession] AccountRestoration.DisplayName failed to fetch display name so we need to enter it manually`
          );
        }
      }, ONBOARDING_TIMES.RECOVERY_FINISHED);
    }

    if (step === AccountRestoration.Complete) {
      if (!isEmpty(displayName)) {
        window.log.debug(
          `WIP: [continueYourSession] AccountRestoration.Complete opening inbox for ${displayName}`
        );
        trigger('openInbox');
      }
    }

    return () => clearInterval(interval);
  }, [dispatch, displayName, progress, step]);

  return (
    <OnboardContainer>
      {step === AccountRestoration.RecoveryPassword || step === AccountRestoration.DisplayName ? (
        <BackButtonWithininContainer margin={'2px 0 0 -36px'}>
          <Flex
            container={true}
            width="100%"
            flexDirection="column"
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
                  onEnterPressed={recoverWithoutDisplayName}
                  error={recoveryPhraseError}
                  enableShowHide={true}
                  inputDataTestId="recovery-phrase-input"
                />
                <SpacerLG />
                <SessionButton
                  buttonColor={SessionButtonColor.White}
                  onClick={recoverWithoutDisplayName}
                  text={window.i18n('continue')}
                  disabled={!activateContinueButton}
                  dataTestId="continue-session-button"
                />
              </>
            ) : (
              <>
                {/* TODO this doesn't load for some reason */}
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
                    onEnterPressed={recoverWithDisplayName}
                    error={displayNameError}
                    inputDataTestId="display-name-input"
                  />
                  <SpacerLG />
                  <SessionButton
                    buttonColor={SessionButtonColor.White}
                    onClick={recoverWithDisplayName}
                    text={window.i18n('continue')}
                  />
                </Flex>
              </>
            )}
          </Flex>
        </BackButtonWithininContainer>
      ) : (
        <Flex
          container={true}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          // TODO update dataTestId
          dataTestId="three-dot-loading-animation"
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
