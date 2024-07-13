// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import pTimeout, { TimeoutError } from 'p-timeout';
import { getIntl } from '../selectors/user';
import { getUpdatesState } from '../selectors/updates';
import { useUpdatesActions } from '../ducks/updates';
import { hasExpired as hasExpiredSelector } from '../selectors/expiration';
import * as log from '../../logging/log';
import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';
import { assertDev } from '../../util/assert';
import { explodePromise } from '../../util/explodePromise';
import { missingCaseError } from '../../util/missingCaseError';
import * as Registration from '../../util/registration';
import {
  InstallScreen,
  InstallScreenStep,
} from '../../components/InstallScreen';
import { InstallError } from '../../components/installScreen/InstallScreenErrorStep';
import { LoadError } from '../../components/installScreen/InstallScreenQrCodeNotScannedStep';
import { MAX_DEVICE_NAME_LENGTH } from '../../components/installScreen/InstallScreenChoosingDeviceNameStep';
import { WidthBreakpoint } from '../../components/_util';
import { HTTPError } from '../../textsecure/Errors';
import { isRecord } from '../../util/isRecord';
import type { ConfirmNumberResultType } from '../../textsecure/AccountManager';
import * as Errors from '../../types/errors';
import { normalizeDeviceName } from '../../util/normalizeDeviceName';
import OS from '../../util/os/osMain';
import { SECOND } from '../../util/durations';
import { BackOff } from '../../util/BackOff';
import { drop } from '../../util/drop';
import { SmartToastManager } from './ToastManager';
import { fileToBytes } from '../../util/fileToBytes';

type PropsType = ComponentProps<typeof InstallScreen>;

type StateType =
  | {
      step: InstallScreenStep.Error;
      error: InstallError;
    }
  | {
      step: InstallScreenStep.QrCodeNotScanned;
      provisioningUrl: Loadable<string, LoadError>;
    }
  | {
      step: InstallScreenStep.ChoosingDeviceName;
      deviceName: string;
      backupFile?: File;
    }
  | {
      step: InstallScreenStep.LinkInProgress;
    };

const INITIAL_STATE: StateType = {
  step: InstallScreenStep.QrCodeNotScanned,
  provisioningUrl: { loadingState: LoadingState.Loading },
};

const qrCodeBackOff = new BackOff([
  10 * SECOND,
  20 * SECOND,
  30 * SECOND,
  60 * SECOND,
]);

function classifyError(
  err: unknown
): { installError: InstallError } | { loadError: LoadError } {
  if (err instanceof HTTPError) {
    switch (err.code) {
      case -1:
        if (
          isRecord(err.cause) &&
          err.cause.code === 'SELF_SIGNED_CERT_IN_CHAIN'
        ) {
          return { loadError: LoadError.NetworkIssue };
        }
        return { installError: InstallError.ConnectionFailed };
      case 409:
        return { installError: InstallError.TooOld };
      case 411:
        return { installError: InstallError.TooManyDevices };
      default:
        return { loadError: LoadError.Unknown };
    }
  }
  // AccountManager.registerSecondDevice uses this specific "websocket closed" error
  //   message.
  if (isRecord(err) && err.message === 'websocket closed') {
    return { installError: InstallError.ConnectionFailed };
  }
  return { loadError: LoadError.Unknown };
}

export const SmartInstallScreen = memo(function SmartInstallScreen() {
  const i18n = useSelector(getIntl);
  const updates = useSelector(getUpdatesState);
  const { startUpdate } = useUpdatesActions();
  const hasExpired = useSelector(hasExpiredSelector);

  const chooseDeviceNamePromiseWrapperRef = useRef(explodePromise<string>());
  const chooseBackupFilePromiseWrapperRef = useRef(
    explodePromise<File | undefined>()
  );

  const [state, setState] = useState<StateType>(INITIAL_STATE);
  const [retryCounter, setRetryCounter] = useState(0);

  const setProvisioningUrl = useCallback(
    (value: string) => {
      setState(currentState => {
        if (currentState.step !== InstallScreenStep.QrCodeNotScanned) {
          return currentState;
        }
        return {
          ...currentState,
          provisioningUrl: {
            loadingState: LoadingState.Loaded,
            value,
          },
        };
      });
    },
    [setState]
  );

  const onQrCodeScanned = useCallback(() => {
    setState(currentState => {
      if (currentState.step !== InstallScreenStep.QrCodeNotScanned) {
        return currentState;
      }

      return {
        step: InstallScreenStep.ChoosingDeviceName,
        deviceName: normalizeDeviceName(
          window.textsecure.storage.user.getDeviceName() ||
            window.getHostName() ||
            ''
        ).slice(0, MAX_DEVICE_NAME_LENGTH),
      };
    });
  }, [setState]);

  const setDeviceName = useCallback(
    (deviceName: string) => {
      setState(currentState => {
        if (currentState.step !== InstallScreenStep.ChoosingDeviceName) {
          return currentState;
        }
        return {
          ...currentState,
          deviceName,
        };
      });
    },
    [setState]
  );

  const setBackupFile = useCallback(
    (backupFile: File) => {
      setState(currentState => {
        if (currentState.step !== InstallScreenStep.ChoosingDeviceName) {
          return currentState;
        }
        return {
          ...currentState,
          backupFile,
        };
      });
    },
    [setState]
  );

  const onSubmitDeviceName = useCallback(() => {
    if (state.step !== InstallScreenStep.ChoosingDeviceName) {
      return;
    }

    let deviceName: string = normalizeDeviceName(state.deviceName);
    if (!deviceName.length) {
      // This should be impossible, but we have it here just in case.
      assertDev(
        false,
        'Unexpected empty device name. Falling back to placeholder value'
      );
      deviceName = i18n('icu:Install__choose-device-name__placeholder');
    }
    chooseDeviceNamePromiseWrapperRef.current.resolve(deviceName);
    chooseBackupFilePromiseWrapperRef.current.resolve(state.backupFile);

    setState({ step: InstallScreenStep.LinkInProgress });
  }, [state, i18n]);

  useEffect(() => {
    let hasCleanedUp = false;
    const qrCodeResolution = explodePromise<void>();

    const accountManager = window.getAccountManager();
    assertDev(accountManager, 'Expected an account manager');

    const updateProvisioningUrl = (value: string): void => {
      if (hasCleanedUp) {
        return;
      }
      qrCodeResolution.resolve();
      setProvisioningUrl(value);
    };

    const confirmNumber = async (): Promise<ConfirmNumberResultType> => {
      if (hasCleanedUp) {
        throw new Error('Cannot confirm number; the component was unmounted');
      }
      onQrCodeScanned();

      let deviceName: string;
      let backupFileData: Uint8Array | undefined;
      if (window.SignalCI) {
        ({ deviceName, backupData: backupFileData } = window.SignalCI);
      } else {
        deviceName = await chooseDeviceNamePromiseWrapperRef.current.promise;
        const backupFile = await chooseBackupFilePromiseWrapperRef.current
          .promise;

        backupFileData = backupFile ? await fileToBytes(backupFile) : undefined;
      }

      if (hasCleanedUp) {
        throw new Error('Cannot confirm number; the component was unmounted');
      }

      // Delete all data from the database unless we're in the middle of a re-link.
      //   Without this, the app restarts at certain times and can cause weird things to
      //   happen, like data from a previous light import showing up after a new install.
      const shouldRetainData = Registration.everDone();
      if (!shouldRetainData) {
        try {
          await window.textsecure.storage.protocol.removeAllData();
        } catch (error) {
          log.error(
            'confirmNumber: error clearing database',
            Errors.toLogFormat(error)
          );
        }
      }

      if (hasCleanedUp) {
        throw new Error('Cannot confirm number; the component was unmounted');
      }

      return { deviceName, backupFile: backupFileData };
    };

    async function getQRCode(): Promise<void> {
      const sleepError = new TimeoutError();
      try {
        const qrCodePromise = accountManager.registerSecondDevice(
          updateProvisioningUrl,
          confirmNumber
        );
        const sleepMs = qrCodeBackOff.getAndIncrement();
        log.info(`InstallScreen/getQRCode: race to ${sleepMs}ms`);
        await Promise.all([
          pTimeout(qrCodeResolution.promise, sleepMs, sleepError),

          // Note that `registerSecondDevice` resolves once the registration
          // is fully complete and thus should not be subjected to a timeout.
          qrCodePromise,
        ]);

        window.IPC.removeSetupMenuItems();
      } catch (error) {
        log.error(
          'account.registerSecondDevice: got an error',
          Errors.toLogFormat(error)
        );
        if (hasCleanedUp) {
          return;
        }

        if (qrCodeBackOff.isFull()) {
          log.error('InstallScreen/getQRCode: too many tries');
          setState({
            step: InstallScreenStep.Error,
            error: InstallError.QRCodeFailed,
          });
          return;
        }

        if (error === sleepError) {
          setState({
            step: InstallScreenStep.QrCodeNotScanned,
            provisioningUrl: {
              loadingState: LoadingState.LoadFailed,
              error: LoadError.Timeout,
            },
          });
          return;
        }
        const classifiedError = classifyError(error);
        if ('installError' in classifiedError) {
          setState({
            step: InstallScreenStep.Error,
            error: classifiedError.installError,
          });
        } else {
          setState({
            step: InstallScreenStep.QrCodeNotScanned,
            provisioningUrl: {
              loadingState: LoadingState.LoadFailed,
              error: classifiedError.loadError,
            },
          });
        }
      }
    }

    drop(getQRCode());

    return () => {
      hasCleanedUp = true;
    };
  }, [setProvisioningUrl, retryCounter, onQrCodeScanned]);

  let props: PropsType;

  switch (state.step) {
    case InstallScreenStep.Error:
      props = {
        step: InstallScreenStep.Error,
        screenSpecificProps: {
          i18n,
          error: state.error,
          quit: () => window.IPC.shutdown(),
          tryAgain: () => {
            setRetryCounter(count => count + 1);
            setState(INITIAL_STATE);
          },
        },
      };
      break;
    case InstallScreenStep.QrCodeNotScanned:
      props = {
        step: InstallScreenStep.QrCodeNotScanned,
        screenSpecificProps: {
          i18n,
          provisioningUrl: state.provisioningUrl,
          hasExpired,
          updates,
          currentVersion: window.getVersion(),
          startUpdate,
          retryGetQrCode: () => {
            setRetryCounter(count => count + 1);
            setState(INITIAL_STATE);
          },
          OS: OS.getName(),
        },
      };
      break;
    case InstallScreenStep.ChoosingDeviceName:
      props = {
        step: InstallScreenStep.ChoosingDeviceName,
        screenSpecificProps: {
          i18n,
          deviceName: state.deviceName,
          setDeviceName,
          setBackupFile,
          onSubmit: onSubmitDeviceName,
        },
      };
      break;
    case InstallScreenStep.LinkInProgress:
      props = {
        step: InstallScreenStep.LinkInProgress,
        screenSpecificProps: { i18n },
      };
      break;
    default:
      throw missingCaseError(state);
  }

  return (
    <>
      <InstallScreen {...props} />
      <SmartToastManager
        disableMegaphone
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
      />
    </>
  );
});
