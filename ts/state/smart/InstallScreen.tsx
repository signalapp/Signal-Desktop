// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps, ReactElement } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { getIntl } from '../selectors/user';

import * as log from '../../logging/log';
import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';
import { assert } from '../../util/assert';
import { explodePromise } from '../../util/explodePromise';
import { missingCaseError } from '../../util/missingCaseError';
import {
  InstallScreen,
  InstallScreenStep,
} from '../../components/InstallScreen';
import { InstallError } from '../../components/installScreen/InstallScreenErrorStep';
import { MAX_DEVICE_NAME_LENGTH } from '../../components/installScreen/InstallScreenChoosingDeviceNameStep';
import { HTTPError } from '../../textsecure/Errors';
import { isRecord } from '../../util/isRecord';
import * as Errors from '../../types/errors';
import { normalizeDeviceName } from '../../util/normalizeDeviceName';

type PropsType = ComponentProps<typeof InstallScreen>;

type StateType =
  | {
      step: InstallScreenStep.Error;
      error: InstallError;
    }
  | {
      step: InstallScreenStep.QrCodeNotScanned;
      provisioningUrl: Loadable<string>;
    }
  | {
      step: InstallScreenStep.ChoosingDeviceName;
      deviceName: string;
    }
  | {
      step: InstallScreenStep.LinkInProgress;
    };

const INITIAL_STATE: StateType = {
  step: InstallScreenStep.QrCodeNotScanned,
  provisioningUrl: { loadingState: LoadingState.Loading },
};

function getInstallError(err: unknown): InstallError {
  if (err instanceof HTTPError) {
    switch (err.code) {
      case -1:
        return InstallError.ConnectionFailed;
      case 409:
        return InstallError.TooOld;
      case 411:
        return InstallError.TooManyDevices;
      default:
        return InstallError.UnknownError;
    }
  }
  // AccountManager.registerSecondDevice uses this specific "websocket closed" error
  //   message.
  if (isRecord(err) && err.message === 'websocket closed') {
    return InstallError.ConnectionFailed;
  }
  return InstallError.UnknownError;
}

export function SmartInstallScreen(): ReactElement {
  const i18n = useSelector(getIntl);

  const chooseDeviceNamePromiseWrapperRef = useRef(explodePromise<string>());

  const [state, setState] = useState<StateType>(INITIAL_STATE);

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

  const onSubmitDeviceName = useCallback(() => {
    if (state.step !== InstallScreenStep.ChoosingDeviceName) {
      return;
    }

    let deviceName: string = normalizeDeviceName(state.deviceName);
    if (!deviceName.length) {
      // This should be impossible, but we have it here just in case.
      assert(
        false,
        'Unexpected empty device name. Falling back to placeholder value'
      );
      deviceName = i18n('Install__choose-device-name__placeholder');
    }
    chooseDeviceNamePromiseWrapperRef.current.resolve(deviceName);

    setState({ step: InstallScreenStep.LinkInProgress });
  }, [state, i18n]);

  useEffect(() => {
    let hasCleanedUp = false;

    const accountManager = window.getAccountManager();
    assert(accountManager, 'Expected an account manager');

    const updateProvisioningUrl = (value: string): void => {
      if (hasCleanedUp) {
        return;
      }
      setProvisioningUrl(value);
    };

    const confirmNumber = async (): Promise<string> => {
      if (hasCleanedUp) {
        throw new Error('Cannot confirm number; the component was unmounted');
      }
      onQrCodeScanned();

      if (window.CI) {
        chooseDeviceNamePromiseWrapperRef.current.resolve(window.CI.deviceName);
      }

      const result = await chooseDeviceNamePromiseWrapperRef.current.promise;

      if (hasCleanedUp) {
        throw new Error('Cannot confirm number; the component was unmounted');
      }

      // Delete all data from the database unless we're in the middle of a re-link.
      //   Without this, the app restarts at certain times and can cause weird things to
      //   happen, like data from a previous light import showing up after a new install.
      const shouldRetainData = window.Signal.Util.Registration.everDone();
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

      return result;
    };

    (async () => {
      try {
        await accountManager.registerSecondDevice(
          updateProvisioningUrl,
          confirmNumber
        );

        window.removeSetupMenuItems();
      } catch (error) {
        log.error(
          'account.registerSecondDevice: got an error',
          Errors.toLogFormat(error)
        );
        if (hasCleanedUp) {
          return;
        }
        setState({
          step: InstallScreenStep.Error,
          error: getInstallError(error),
        });
      }
    })();

    return () => {
      hasCleanedUp = true;
    };
  }, [setProvisioningUrl, onQrCodeScanned]);

  let props: PropsType;

  switch (state.step) {
    case InstallScreenStep.Error:
      props = {
        step: InstallScreenStep.Error,
        screenSpecificProps: {
          i18n,
          error: state.error,
          quit: () => window.shutdown(),
          tryAgain: () => setState(INITIAL_STATE),
        },
      };
      break;
    case InstallScreenStep.QrCodeNotScanned:
      props = {
        step: InstallScreenStep.QrCodeNotScanned,
        screenSpecificProps: {
          i18n,
          provisioningUrl: state.provisioningUrl,
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

  return <InstallScreen {...props} />;
}
