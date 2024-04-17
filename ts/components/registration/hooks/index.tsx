import { isEmpty } from 'lodash';
import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ONBOARDING_TIMES } from '../../../session/constants';
import {
  AccountRestoration,
  setAccountRestorationStep,
  setProgress,
} from '../../../state/onboarding/ducks/registration';
import {
  useDisplayName,
  useOnboardAccountRestorationStep,
  useOnboardHexGeneratedPubKey,
  useProgress,
} from '../../../state/onboarding/selectors/registration';
import { finishRestore } from '../stages/RestoreAccount';

let interval: NodeJS.Timeout;

/** Effect to handle the progress rate of the recovery loading animation */
export const useRecoveryProgressEffect = () => {
  const totalProgress = 100;

  const step = useOnboardAccountRestorationStep();
  const ourPubkey = useOnboardHexGeneratedPubKey();
  const displayName = useDisplayName();
  const progress = useProgress();
  const dispatch = useDispatch();

  const recoveryComplete = useCallback(async () => {
    await finishRestore(ourPubkey, displayName);
  }, [displayName, ourPubkey]);

  useEffect(() => {
    switch (step) {
      case AccountRestoration.Loading:
        interval = setInterval(() => {
          if (progress < totalProgress) {
            dispatch(setProgress(progress + 1));
          }

          if (progress >= totalProgress) {
            clearInterval(interval);
            // if we didn't get the display name in time, we need to enter it manually
            dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
          }
        }, ONBOARDING_TIMES.RECOVERY_TIMEOUT / totalProgress);
        break;
      case AccountRestoration.Finishing:
        interval = setInterval(() => {
          if (progress < totalProgress) {
            dispatch(setProgress(progress + 1));
          }

          if (progress >= totalProgress) {
            clearInterval(interval);
            dispatch(setAccountRestorationStep(AccountRestoration.Finished));
          }
        }, ONBOARDING_TIMES.RECOVERY_FINISHING / totalProgress);
        break;
      case AccountRestoration.Finished:
        interval = setInterval(() => {
          clearInterval(interval);
          if (!isEmpty(displayName)) {
            dispatch(setAccountRestorationStep(AccountRestoration.Complete));
          } else {
            // if we didn't get the display name in time, we need to enter it manually
            dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
          }
        }, ONBOARDING_TIMES.RECOVERY_FINISHED);
        break;
      case AccountRestoration.Complete:
        clearInterval(interval);
        if (!isEmpty(ourPubkey) && !isEmpty(displayName)) {
          void recoveryComplete();
        } else {
          window.log.debug(`[onboarding] restore account: We don't have a pubkey or display name`);
          dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
        }
        break;
      default:
    }

    return () => clearInterval(interval);
  }, [dispatch, displayName, ourPubkey, progress, recoveryComplete, step]);
};
