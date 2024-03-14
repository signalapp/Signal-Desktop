import { Dispatch } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';
import { useEffect } from 'react';
import { ONBOARDING_TIMES } from '../../../session/constants';
import { trigger } from '../../../shims/events';
import {
  AccountRestoration,
  setAccountRestorationStep,
} from '../../../state/onboarding/ducks/registration';

let interval: NodeJS.Timeout;

type UseRecoveryProgressEffectProps = {
  step: AccountRestoration;
  progress: number;
  setProgress: (progress: number) => void;
  displayName: string;
  dispatch: Dispatch;
};

/**
 * Effect to handle the progress rate of the recovery loading animation
 * @param step AccountRestoration the onboarding step we are currently on
 * @param progress number the progress of the loading bar
 * @param setProgress (progress: number) => void function to set the progress of the loading bar
 * @param displayName string the display name of the user
 * @param dispatch
 */
export const useRecoveryProgressEffect = (props: UseRecoveryProgressEffectProps) => {
  const { step, progress, setProgress, displayName, dispatch } = props;

  useEffect(() => {
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
            `WIP: [continueYourSession] AccountRestoration.Loading We didn't get the display name in time, so we need to enter it manually`
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
          dispatch(setAccountRestorationStep(AccountRestoration.DisplayName));
          window.log.debug(
            `WIP: [continueYourSession] AccountRestoration.DisplayName failed to fetch display name so we need to enter it manually`
          );
        }
      }, ONBOARDING_TIMES.RECOVERY_FINISHED);
    }

    if (step === AccountRestoration.Complete) {
      clearInterval(interval);
      if (!isEmpty(displayName)) {
        window.log.debug(
          `WIP: [continueYourSession] AccountRestoration.Complete opening inbox for ${displayName}`
        );
        trigger('openInbox');
      }
    }

    return () => clearInterval(interval);
  }, [dispatch, displayName, progress, setProgress, step]);
};
