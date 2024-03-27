import { AnyAction } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';
import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ONBOARDING_TIMES } from '../../../session/constants';
import {
  AccountRestoration,
  setAccountRestorationStep,
} from '../../../state/onboarding/ducks/registration';
import { finishRestore } from '../stages/RestoreAccount';

let interval: NodeJS.Timeout;

type UseRecoveryProgressEffectProps = {
  step: AccountRestoration;
  progress: number;
  setProgress: (progress: number) => AnyAction;
  ourPubkey: string;
  displayName: string;
};

/**
 * Effect to handle the progress rate of the recovery loading animation
 * @param step AccountRestoration the onboarding step we are currently on
 * @param progress number the progress of the loading bar
 * @param setProgress (progress: number) => AnyAction redux function to set the progress of the loading bar
 * @param ourPubkey: string the public key of the user
 * @param displayName: string the display name of the user
 */
export const useRecoveryProgressEffect = (props: UseRecoveryProgressEffectProps) => {
  const { step, progress, setProgress, ourPubkey, displayName } = props;
  const totalProgress = 100;

  const dispatch = useDispatch();

  const recoveryComplete = useCallback(async () => {
    await finishRestore(ourPubkey, displayName);
  }, [displayName, ourPubkey]);

  useEffect(() => {
    if (step === AccountRestoration.Loading) {
      interval = setInterval(() => {
        window.log.debug(
          `WIP: [onboarding] restore account: ${AccountRestoration[step]} ${progress}%`
        );

        if (progress < totalProgress) {
          dispatch(setProgress(progress + 1));
        }

        if (progress >= totalProgress) {
          clearInterval(interval);
          // if we didn't get the display name in time, we need to enter it manually
          dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
        }
      }, ONBOARDING_TIMES.RECOVERY_TIMEOUT / totalProgress);
    }

    if (step === AccountRestoration.Finishing) {
      interval = setInterval(() => {
        window.log.debug(
          `WIP: [onboarding] restore account: ${AccountRestoration[step]} ${progress}%`
        );

        if (progress < totalProgress) {
          dispatch(setProgress(progress + 1));
        }

        if (progress >= totalProgress) {
          clearInterval(interval);
          dispatch(setAccountRestorationStep(AccountRestoration.Finished));
        }
      }, ONBOARDING_TIMES.RECOVERY_FINISHING / totalProgress);
    }

    if (step === AccountRestoration.Finished) {
      interval = setInterval(() => {
        window.log.debug(
          `WIP: [onboarding] restore account: ${AccountRestoration[step]} ${progress}%`
        );

        clearInterval(interval);
        if (!isEmpty(displayName)) {
          dispatch(setAccountRestorationStep(AccountRestoration.Complete));
        } else {
          // if we didn't get the display name in time, we need to enter it manually
          dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
        }
      }, ONBOARDING_TIMES.RECOVERY_FINISHED);
    }

    if (step === AccountRestoration.Complete) {
      window.log.debug(
        `WIP: [onboarding] restore account: ${AccountRestoration[step]} ${progress}%`
      );
      clearInterval(interval);
      if (!isEmpty(ourPubkey) && !isEmpty(displayName)) {
        void recoveryComplete();
      } else {
        window.log.debug(
          `WIP: [onboarding] restore account: We don't have a pubkey or display name`
        );
        dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
      }
    }

    return () => clearInterval(interval);
  }, [dispatch, displayName, ourPubkey, progress, recoveryComplete, setProgress, step]);
};
