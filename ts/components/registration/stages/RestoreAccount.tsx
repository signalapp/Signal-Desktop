import { Dispatch } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import { ONBOARDING_TIMES } from '../../../session/constants';
import { InvalidWordsError, NotEnoughWordsError } from '../../../session/crypto/mnemonic';
import { PromiseUtils } from '../../../session/utils';
import { TaskTimedOutError } from '../../../session/utils/Promise';
import { NotFoundError } from '../../../session/utils/errors';
import { trigger } from '../../../shims/events';
import {
  AccountRestoration,
  setAccountRestorationStep,
  setDisplayName,
  setDisplayNameError,
  setHexGeneratedPubKey,
  setProgress,
  setRecoveryPassword,
  setRecoveryPasswordError,
} from '../../../state/onboarding/ducks/registration';
import {
  useDisplayName,
  useDisplayNameError,
  useOnboardAccountRestorationStep,
  useProgress,
  useRecoveryPassword,
  useRecoveryPasswordError,
} from '../../../state/onboarding/selectors/registration';
import {
  registerSingleDevice,
  registrationDone,
  signInByLinkingDevice,
} from '../../../util/accountManager';
import { setSignInByLinking, setSignWithRecoveryPhrase } from '../../../util/storage';
import { Flex } from '../../basic/Flex';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../../basic/Text';
import { SessionIcon } from '../../icon';
import { SessionInput } from '../../inputs';
import { SessionProgressBar } from '../../loading';
import { resetRegistration } from '../RegistrationStages';
import { OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithinContainer } from '../components/BackButton';
import { useRecoveryProgressEffect } from '../hooks';
import { displayNameIsValid, sanitizeDisplayNameOrToast } from '../utils';
import { AccountDetails } from './CreateAccount';

type AccountRestoreDetails = AccountDetails & { dispatch: Dispatch; abortSignal?: AbortSignal };

export async function finishRestore(pubkey: string, displayName: string) {
  await setSignWithRecoveryPhrase(true);
  await registrationDone(pubkey, displayName);

  trigger('openInbox');
}

/**
 * This will try to sign in with the user recovery password.
 * If no ConfigurationMessage is received within ONBOARDING_RECOVERY_TIMEOUT, the user will be asked to enter a display name.
 */
async function signInAndFetchDisplayName({
  recoveryPassword,
  dispatch,
  abortSignal,
}: AccountRestoreDetails) {
  try {
    await resetRegistration();
    const promiseLink = signInByLinkingDevice(recoveryPassword, 'english', abortSignal);
    const promiseWait = PromiseUtils.waitForTask(done => {
      window.Whisper.events.on(
        'configurationMessageReceived',
        async (ourPubkey: string, displayName: string) => {
          window.Whisper.events.off('configurationMessageReceived');
          await setSignInByLinking(false);
          dispatch(setHexGeneratedPubKey(ourPubkey));
          dispatch(setDisplayName(displayName));
          dispatch(setAccountRestorationStep(AccountRestoration.Finishing));
          done(displayName);
        }
      );
    }, ONBOARDING_TIMES.RECOVERY_TIMEOUT);

    await Promise.all([promiseLink, promiseWait]);
  } catch (e) {
    await resetRegistration();
    throw e;
  }
}

/**
 * Sign in/restore from seed.
 * Ask for a display name, as we will drop incoming ConfigurationMessages if any are saved on the swarm.
 * We will handle a ConfigurationMessage
 */
async function signInWithNewDisplayName({
  displayName,
  recoveryPassword,
  dispatch,
}: AccountRestoreDetails) {
  try {
    const validDisplayName = displayNameIsValid(displayName);

    await resetRegistration();
    await registerSingleDevice(
      recoveryPassword,
      'english',
      validDisplayName,
      async (pubkey: string) => {
        dispatch(setHexGeneratedPubKey(pubkey));
        dispatch(setDisplayName(validDisplayName));
        await finishRestore(pubkey, validDisplayName);
      }
    );
  } catch (e) {
    await resetRegistration();
    throw e;
  }
}

export const RestoreAccount = () => {
  const step = useOnboardAccountRestorationStep();
  const recoveryPassword = useRecoveryPassword();
  const recoveryPasswordError = useRecoveryPasswordError();
  const displayName = useDisplayName();
  const displayNameError = useDisplayNameError();
  const progress = useProgress();

  const dispatch = useDispatch();

  useRecoveryProgressEffect();

  const recoverAndFetchDisplayName = async () => {
    if (!(!!recoveryPassword && !recoveryPasswordError)) {
      return;
    }

    const abortController = new AbortController();
    try {
      dispatch(setProgress(0));
      dispatch(setAccountRestorationStep(AccountRestoration.Loading));
      await signInAndFetchDisplayName({
        recoveryPassword,
        dispatch,
        abortSignal: abortController.signal,
      });
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof TaskTimedOutError) {
        // abort display name polling if we get either error
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
        window.log.error(
          `[onboarding] restore account: Failed to fetch a display name, so we will have to enter it manually. Error: ${e.message || e} `
        );
        return;
      }

      if (e instanceof NotEnoughWordsError) {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageShort')));
      } else if (e instanceof InvalidWordsError) {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageIncorrect')));
      } else {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageGeneric')));
      }
      dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
    }
  };

  const recoverAndEnterDisplayName = async () => {
    if (
      isEmpty(recoveryPassword) ||
      !isEmpty(recoveryPasswordError) ||
      isEmpty(displayName) ||
      !isEmpty(displayNameError)
    ) {
      return;
    }

    try {
      await signInWithNewDisplayName({
        displayName,
        recoveryPassword,
        dispatch,
      });
    } catch (e) {
      window.log.error(
        `[onboarding] restore account: Failed with new display name! Error: ${e.message || e}`
      );
      dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
      dispatch(setDisplayNameError(e.message || String(e)));
    }
  };

  return (
    <>
      {step === AccountRestoration.RecoveryPassword || step === AccountRestoration.DisplayName ? (
        <BackButtonWithinContainer
          margin={'2px 0 0 -36px'}
          callback={() => {
            dispatch(setRecoveryPassword(''));
            dispatch(setDisplayName(''));
            dispatch(setProgress(0));
            dispatch(setRecoveryPasswordError(undefined));
            dispatch(setDisplayNameError(undefined));
          }}
        >
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
                    iconSize="huge"
                    iconColor="var(--text-primary-color)"
                    style={{ margin: '-4px 0 0 8px' }}
                  />
                </Flex>
                <SpacerSM />
                <OnboardDescription>{window.i18n('onboardingRecoveryPassword')}</OnboardDescription>
                <SpacerLG />
                <SessionInput
                  autoFocus={true}
                  disabledOnBlur={true}
                  type="password"
                  placeholder={window.i18n('recoveryPasswordEnter')}
                  value={recoveryPassword}
                  onValueChanged={(seed: string) => {
                    dispatch(setRecoveryPassword(seed));
                    dispatch(
                      setRecoveryPasswordError(
                        !seed ? window.i18n('recoveryPasswordEnter') : undefined
                      )
                    );
                  }}
                  onEnterPressed={recoverAndFetchDisplayName}
                  error={recoveryPasswordError}
                  enableShowHide={true}
                  inputDataTestId="recovery-phrase-input"
                />
                <SpacerLG />
                <SessionButton
                  buttonColor={SessionButtonColor.White}
                  onClick={recoverAndFetchDisplayName}
                  text={window.i18n('continue')}
                  disabled={!(!!recoveryPassword && !recoveryPasswordError)}
                  dataTestId="continue-button"
                />
              </>
            ) : (
              <Flex container={true} width="100%" flexDirection="column" alignItems="flex-start">
                <OnboardHeading>{window.i18n('displayNameNew')}</OnboardHeading>
                <SpacerSM />
                <OnboardDescription>{window.i18n('displayNameErrorNew')}</OnboardDescription>
                <SpacerLG />
                <SessionInput
                  autoFocus={true}
                  disabledOnBlur={true}
                  type="text"
                  placeholder={window.i18n('enterDisplayName')}
                  value={displayName}
                  onValueChanged={(name: string) => {
                    const sanitizedName = sanitizeDisplayNameOrToast(
                      name,
                      setDisplayNameError,
                      dispatch
                    );
                    dispatch(setDisplayName(sanitizedName));
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
                    isEmpty(recoveryPassword) ||
                    !isEmpty(recoveryPasswordError) ||
                    isEmpty(displayName) ||
                    !isEmpty(displayNameError)
                  }
                  dataTestId="continue-button"
                />
              </Flex>
            )}
          </Flex>
        </BackButtonWithinContainer>
      ) : (
        <Flex
          container={true}
          width="100%"
          flexDirection="column"
          justifyContent="flex-start"
          alignItems="flex-start"
        >
          <SessionProgressBar
            initialValue={
              step !== AccountRestoration.Finished && step !== AccountRestoration.Complete ? 0 : 100
            }
            progress={progress}
            margin={'0'}
            title={window.i18n('waitOneMoment')}
            subtitle={window.i18n('loadAccountProgressMessage')}
            showPercentage={true}
          />
        </Flex>
      )}
    </>
  );
};
