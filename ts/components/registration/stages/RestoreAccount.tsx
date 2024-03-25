import { useDispatch } from 'react-redux';
import { ONBOARDING_TIMES } from '../../../session/constants';
import { InvalidWordsError, NotEnoughWordsError } from '../../../session/crypto/mnemonic';
import { PromiseUtils } from '../../../session/utils';
import { TaskTimedOutError } from '../../../session/utils/Promise';
import { NotFoundError } from '../../../session/utils/errors';
import {
  AccountRestoration,
  setAccountRestorationStep,
  setDisplayName,
  setDisplayNameError,
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
import { RecoverDetails, resetRegistration } from '../RegistrationStages';
import { OnboardDescription, OnboardHeading } from '../components';
import { BackButtonWithininContainer } from '../components/BackButton';
import { useRecoveryProgressEffect } from '../hooks';
import { displayNameIsValid, sanitizeDisplayNameOrToast } from '../utils';

/**
 * Sign in/restore from seed.
 * Ask for a display name, as we will drop incoming ConfigurationMessages if any are saved on the swarm.
 * We will handle a ConfigurationMessage
 */
async function signInWithNewDisplayName(signInDetails: RecoverDetails) {
  const { displayName, recoveryPassword, errorCallback } = signInDetails;
  window.log.debug(`WIP: [signInWithNewDisplayName] starting sign in with new display name....`);

  try {
    const trimName = displayNameIsValid(displayName);

    await resetRegistration();
    await registerSingleDevice(recoveryPassword, 'english', trimName);
    await setSignWithRecoveryPhrase(true);
  } catch (e) {
    await resetRegistration();
    errorCallback(e);
    window.log.debug(
      `WIP: [signInWithNewDisplayName] exception during registration: ${e.message || e}`
    );
  }
}

/**
 * This will try to sign in with the user recovery phrase.
 * If no ConfigurationMessage is received within ONBOARDING_RECOVERY_TIMEOUT, the user will be asked to enter a display name.
 */
async function signInAndFetchDisplayName(
  signInDetails: RecoverDetails & {
    /** this is used to trigger the loading animation further down the registration pipeline */
    loadingAnimationCallback: () => void;
  }
) {
  const { recoveryPassword, loadingAnimationCallback } = signInDetails;
  window.log.debug(`WIP: [signInAndFetchDisplayName] starting sign in....`);

  let displayNameFromNetwork = '';
  let ourPubkey = '';

  try {
    await resetRegistration();
    const promiseLink = signInByLinkingDevice(
      recoveryPassword,
      'english',
      loadingAnimationCallback
    );

    const promiseWait = PromiseUtils.waitForTask(done => {
      window.Whisper.events.on(
        'configurationMessageReceived',
        async (displayName: string, pubkey: string) => {
          window.Whisper.events.off('configurationMessageReceived');
          await setSignInByLinking(false);
          await setSignWithRecoveryPhrase(true);

          displayNameFromNetwork = displayName;
          ourPubkey = pubkey;
          done(displayName);
        }
      );
    }, ONBOARDING_TIMES.RECOVERY_TIMEOUT);

    await Promise.all([promiseLink, promiseWait]);
  } catch (e) {
    await resetRegistration();
    throw e;
  }

  window.log.debug(
    `WIP: [signInAndFetchDisplayName] signed in with displayName: "${displayNameFromNetwork}" and pubkey: "${ourPubkey}`
  );
  return { displayNameFromNetwork, ourPubkey };
}

export const RestoreAccount = () => {
  const step = useOnboardAccountRestorationStep();
  const recoveryPassword = useRecoveryPassword();
  const recoveryPasswordError = useRecoveryPasswordError();
  const displayName = useDisplayName();
  const displayNameError = useDisplayNameError();
  const progress = useProgress();

  const dispatch = useDispatch();

  useRecoveryProgressEffect({ step, progress, setProgress, displayName, dispatch });

  const recoverAndFetchDisplayName = async () => {
    if (!(!!recoveryPassword && !recoveryPasswordError)) {
      return;
    }

    dispatch(setProgress(0));
    try {
      const { displayNameFromNetwork, ourPubkey } = await signInAndFetchDisplayName({
        recoveryPassword,
        errorCallback: e => {
          throw e;
        },
        loadingAnimationCallback: () => {
          dispatch(setAccountRestorationStep(AccountRestoration.Loading));
        },
      });
      dispatch(setDisplayName(displayNameFromNetwork));
      await registrationDone(ourPubkey, displayName);
      dispatch(setAccountRestorationStep(AccountRestoration.Finishing));
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof TaskTimedOutError) {
        window.log.debug(
          `WIP: [recoverAndFetchDisplayName] AccountRestoration.RecoveryPassword failed to get a display name so we need to enter it manually. Error: ${e}`
        );
        dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
        return;
      }

      if (e instanceof NotEnoughWordsError) {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageShort')));
      } else if (e instanceof InvalidWordsError) {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageIncorrect')));
      } else {
        dispatch(setRecoveryPasswordError(window.i18n('recoveryPasswordErrorMessageGeneric')));
      }
      window.log.debug(
        `WIP: [recoverAndFetchDisplayName] exception during registration: ${e.message || e} type ${typeof JSON.stringify(e)}`
      );
      dispatch(setAccountRestorationStep(AccountRestoration.RecoveryPassword));
    }
  };

  const recoverAndEnterDisplayName = async () => {
    if (!(!!recoveryPassword && !recoveryPasswordError) || !(!!displayName && !displayNameError)) {
      return;
    }

    dispatch(setProgress(0));
    try {
      await signInWithNewDisplayName({
        displayName,
        recoveryPassword,
        errorCallback: e => {
          dispatch(setDisplayNameError(e.message || String(e)));
          throw e;
        },
      });
      dispatch(setAccountRestorationStep(AccountRestoration.Complete));
    } catch (e) {
      window.log.debug(
        `WIP: [recoverAndEnterDisplayName] AccountRestoration.DisplayName failed to set the display name. Error: ${e}`
      );
      dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
    }
  };

  return (
    <>
      {step === AccountRestoration.RecoveryPassword || step === AccountRestoration.DisplayName ? (
        <BackButtonWithininContainer
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
                  disabledOnBlur={true}
                  type="password"
                  placeholder={window.i18n('enterRecoveryPhrase')}
                  value={recoveryPassword}
                  onValueChanged={(seed: string) => {
                    dispatch(setRecoveryPassword(seed));
                    dispatch(
                      setRecoveryPasswordError(
                        !seed ? window.i18n('recoveryPhraseEmpty') : undefined
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
                  dataTestId="continue-session-button"
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
                  onValueChanged={(_name: string) => {
                    const name = sanitizeDisplayNameOrToast(_name, setDisplayNameError, dispatch);
                    dispatch(setDisplayName(name));
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
                    !(!!recoveryPassword && !recoveryPasswordError) ||
                    !(!!displayName && !displayNameError)
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
          alignItems="flex-start"
        >
          <SessionProgressBar
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
