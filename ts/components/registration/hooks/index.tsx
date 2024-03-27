import { AnyAction } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';
import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ONBOARDING_TIMES } from '../../../session/constants';
import { trigger } from '../../../shims/events';
import {
  AccountRestoration,
  setAccountRestorationStep,
} from '../../../state/onboarding/ducks/registration';
import { registrationDone } from '../../../util/accountManager';
import { setSignWithRecoveryPhrase } from '../../../util/storage';

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

  const dispatch = useDispatch();

  const recoveryComplete = useCallback(async () => {
    await setSignWithRecoveryPhrase(true);
    await registrationDone(ourPubkey, displayName);

    window.log.debug(`WIP: [onboarding] restore account: loggin in for ${displayName}`);
    trigger('openInbox');
  }, [displayName, ourPubkey]);

  useEffect(() => {
    if (step === AccountRestoration.Loading) {
      interval = setInterval(() => {
        if (progress < 100) {
          dispatch(setProgress(progress + 1));
        }

        if (progress >= 100) {
          clearInterval(interval);
          // if we didn't get the display name in time, we need to enter it manually
          window.log.debug(
            `WIP: [onboarding] restore account: We failed with a time out when fetching a display, so we had to enter it manually`
          );
          dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
        }
      }, ONBOARDING_TIMES.RECOVERY_TIMEOUT / 100);
    }

    if (step === AccountRestoration.Finishing) {
      interval = setInterval(() => {
        if (progress < 100) {
          dispatch(setProgress(progress + 1));
        }

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
          dispatch(setAccountRestorationStep(AccountRestoration.Complete));
        } else {
          window.log.debug(
            `WIP: [onboarding] restore account: We failed with an error when fetching a display name, so we had to enter it manually`
          );
          dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
        }
      }, ONBOARDING_TIMES.RECOVERY_FINISHED);
    }

    if (step === AccountRestoration.Complete) {
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
