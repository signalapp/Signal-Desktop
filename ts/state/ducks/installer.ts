// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import pTimeout, { TimeoutError } from 'p-timeout';

import type { StateType as RootStateType } from '../reducer';
import {
  type InstallScreenBackupError,
  InstallScreenBackupStep,
  InstallScreenStep,
  InstallScreenError,
  InstallScreenQRCodeError,
} from '../../types/InstallScreen';
import * as Errors from '../../types/errors';
import { type Loadable, LoadingState } from '../../util/loadable';
import { isRecord } from '../../util/isRecord';
import { strictAssert } from '../../util/assert';
import { SECOND } from '../../util/durations';
import * as Registration from '../../util/registration';
import { isBackupEnabled } from '../../util/isBackupEnabled';
import { HTTPError, InactiveTimeoutError } from '../../textsecure/Errors';
import {
  Provisioner,
  type PrepareLinkDataOptionsType,
} from '../../textsecure/Provisioner';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import * as log from '../../logging/log';
import { backupsService } from '../../services/backups';
import OS from '../../util/os/osMain';

const SLEEP_ERROR = new TimeoutError();

const QR_CODE_TIMEOUTS = [10 * SECOND, 20 * SECOND, 30 * SECOND, 60 * SECOND];

export type BatonType = ReadonlyDeep<{ __installer_baton: never }>;

const controllerByBaton = new WeakMap<BatonType, AbortController>();
const provisionerByBaton = new WeakMap<BatonType, Provisioner>();

export type InstallerStateType = ReadonlyDeep<
  | {
      step: InstallScreenStep.NotStarted;
    }
  | {
      step: InstallScreenStep.QrCodeNotScanned;
      provisioningUrl: Loadable<string, InstallScreenQRCodeError>;
      baton: BatonType;
      attemptCount: number;
    }
  | {
      step: InstallScreenStep.ChoosingDeviceName;
      deviceName: string;
      backupFile?: File;
      baton: BatonType;
    }
  | {
      step: InstallScreenStep.Error;
      error: InstallScreenError;
    }
  | {
      step: InstallScreenStep.LinkInProgress;
    }
  | {
      step: InstallScreenStep.BackupImport;
      backupStep: InstallScreenBackupStep;
      currentBytes?: number;
      totalBytes?: number;
      error?: InstallScreenBackupError;
    }
>;

export type RetryBackupImportValue = ReadonlyDeep<'retry' | 'cancel'>;

export const START_INSTALLER = 'installer/START_INSTALLER';
const SET_PROVISIONING_URL = 'installer/SET_PROVISIONING_URL';
const SET_QR_CODE_ERROR = 'installer/SET_QR_CODE_ERROR';
const SET_ERROR = 'installer/SET_ERROR';
const QR_CODE_SCANNED = 'installer/QR_CODE_SCANNED';
const RETRY_BACKUP_IMPORT = 'installer/RETRY_BACKUP_IMPORT';
const SHOW_LINK_IN_PROGRESS = 'installer/SHOW_LINK_IN_PROGRESS';
export const SHOW_BACKUP_IMPORT = 'installer/SHOW_BACKUP_IMPORT';
const UPDATE_BACKUP_IMPORT_PROGRESS = 'installer/UPDATE_BACKUP_IMPORT_PROGRESS';

export type StartInstallerActionType = ReadonlyDeep<{
  type: typeof START_INSTALLER;
  payload: BatonType;
}>;

type SetProvisioningUrlActionType = ReadonlyDeep<{
  type: typeof SET_PROVISIONING_URL;
  payload: string;
}>;

type SetQRCodeErrorActionType = ReadonlyDeep<{
  type: typeof SET_QR_CODE_ERROR;
  payload: InstallScreenQRCodeError;
}>;

type SetErrorActionType = ReadonlyDeep<{
  type: typeof SET_ERROR;
  payload: InstallScreenError;
}>;

type QRCodeScannedActionType = ReadonlyDeep<{
  type: typeof QR_CODE_SCANNED;
  payload: {
    deviceName: string;
    baton: BatonType;
  };
}>;

type RetryBackupImportActionType = ReadonlyDeep<{
  type: typeof RETRY_BACKUP_IMPORT;
}>;

type ShowLinkInProgressActionType = ReadonlyDeep<{
  type: typeof SHOW_LINK_IN_PROGRESS;
}>;

export type ShowBackupImportActionType = ReadonlyDeep<{
  type: typeof SHOW_BACKUP_IMPORT;
}>;

type UpdateBackupImportProgressActionType = ReadonlyDeep<{
  type: typeof UPDATE_BACKUP_IMPORT_PROGRESS;
  payload:
    | {
        backupStep: InstallScreenBackupStep;
        currentBytes: number;
        totalBytes: number;
      }
    | {
        error: InstallScreenBackupError;
      };
}>;

export type InstallerActionType = ReadonlyDeep<
  | StartInstallerActionType
  | SetProvisioningUrlActionType
  | SetQRCodeErrorActionType
  | SetErrorActionType
  | QRCodeScannedActionType
  | RetryBackupImportActionType
  | ShowLinkInProgressActionType
  | ShowBackupImportActionType
  | UpdateBackupImportProgressActionType
>;

export const actions = {
  startInstaller,
  finishInstall,
  updateBackupImportProgress,
  retryBackupImport,
  showBackupImport,
  showLinkInProgress,
};

export const useInstallerActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function startInstaller(): ThunkAction<
  void,
  RootStateType,
  unknown,
  InstallerActionType
> {
  return async (dispatch, getState) => {
    // WeakMap key
    const baton = {} as BatonType;

    window.IPC.addSetupMenuItems();

    dispatch({
      type: START_INSTALLER,
      payload: baton,
    });
    const { installer: state } = getState();
    strictAssert(
      state.step === InstallScreenStep.QrCodeNotScanned,
      'Unexpected step after START_INSTALLER'
    );
    const { attemptCount } = state;

    // Can't retry past attempt count
    if (attemptCount >= QR_CODE_TIMEOUTS.length - 1) {
      log.error('InstallScreen/getQRCode: too many tries');
      dispatch({
        type: SET_ERROR,
        payload: InstallScreenError.QRCodeFailed,
      });
      return;
    }

    const { server } = window.textsecure;
    strictAssert(server, 'Expected a server');

    const provisioner = new Provisioner({
      server,
      appVersion: window.getVersion(),
    });

    const abortController = new AbortController();
    const { signal } = abortController;
    signal.addEventListener('abort', () => {
      provisioner.close();
    });

    controllerByBaton.set(baton, abortController);

    // Wait to get QR code
    try {
      const qrCodePromise = provisioner.getURL();
      const sleepMs = QR_CODE_TIMEOUTS[attemptCount];
      log.info(`installer/getQRCode: race to ${sleepMs}ms`);

      const url = await pTimeout(qrCodePromise, sleepMs, SLEEP_ERROR);
      if (signal.aborted) {
        return;
      }

      dispatch({
        type: SET_PROVISIONING_URL,
        payload: url,
      });
    } catch (error) {
      provisioner.close();

      if (signal.aborted) {
        return;
      }

      log.error(
        'installer: got an error while waiting for QR code',
        Errors.toLogFormat(error)
      );

      // Too many attempts, there is probably some issue
      if (attemptCount >= QR_CODE_TIMEOUTS.length - 1) {
        log.error('InstallScreen/getQRCode: too many tries');
        dispatch({
          type: SET_ERROR,
          payload: InstallScreenError.QRCodeFailed,
        });
        return;
      }

      // Timed out, let user retry
      if (error === SLEEP_ERROR) {
        dispatch({
          type: SET_QR_CODE_ERROR,
          payload: InstallScreenQRCodeError.Timeout,
        });
        return;
      }

      if (error instanceof HTTPError && error.code === -1) {
        if (
          isRecord(error.cause) &&
          error.cause.code === 'SELF_SIGNED_CERT_IN_CHAIN'
        ) {
          dispatch({
            type: SET_QR_CODE_ERROR,
            payload: InstallScreenQRCodeError.NetworkIssue,
          });
          return;
        }
        dispatch({
          type: SET_ERROR,
          payload: InstallScreenError.ConnectionFailed,
        });
        return;
      }

      dispatch({
        type: SET_QR_CODE_ERROR,
        payload: InstallScreenQRCodeError.Unknown,
      });
      return;
    }

    if (signal.aborted) {
      log.warn('installer/startInstaller: aborted');
      return;
    }

    // Wait for primary device to scan QR code and get back to us

    try {
      await provisioner.waitForEnvelope();
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      log.error(
        'installer: got an error while waiting for envelope code',
        Errors.toLogFormat(error)
      );

      if (error instanceof InactiveTimeoutError) {
        dispatch({
          type: SET_ERROR,
          payload: InstallScreenError.InactiveTimeout,
        });
        return;
      }

      dispatch({
        type: SET_ERROR,
        payload: InstallScreenError.ConnectionFailed,
      });
      return;
    }

    if (signal.aborted) {
      return;
    }
    provisionerByBaton.set(baton, provisioner);

    if (provisioner.isLinkAndSync()) {
      dispatch(finishInstall({ deviceName: OS.getName() || 'Signal Desktop' }));
    } else {
      // Show screen to choose device name
      dispatch({
        type: QR_CODE_SCANNED,
        payload: {
          deviceName:
            window.textsecure.storage.user.getDeviceName() ||
            window.getHostName() ||
            '',
          baton,
        },
      });

      // And feed it the CI data if present
      const { SignalCI } = window;
      if (SignalCI != null) {
        dispatch(
          finishInstall({
            deviceName: SignalCI.deviceName,
          })
        );
      }
    }
  };
}

function finishInstall(
  options: PrepareLinkDataOptionsType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  | SetQRCodeErrorActionType
  | SetErrorActionType
  | ShowLinkInProgressActionType
  | ShowBackupImportActionType
> {
  return async (dispatch, getState) => {
    const state = getState();
    strictAssert(
      state.installer.step === InstallScreenStep.ChoosingDeviceName ||
        state.installer.step === InstallScreenStep.QrCodeNotScanned,
      'Wrong step'
    );

    const { baton } = state.installer;
    const provisioner = provisionerByBaton.get(baton);
    strictAssert(
      provisioner != null,
      'Provisioner is not waiting for device info'
    );

    if (state.installer.step === InstallScreenStep.QrCodeNotScanned) {
      strictAssert(
        provisioner.isLinkAndSync(),
        'Can only skip device naming if link & sync'
      );
    }

    // Cleanup
    controllerByBaton.delete(baton);
    provisionerByBaton.delete(baton);

    const accountManager = window.getAccountManager();
    strictAssert(accountManager, 'Expected an account manager');

    if (isBackupEnabled() || provisioner.isLinkAndSync()) {
      dispatch({ type: SHOW_BACKUP_IMPORT });
    } else {
      dispatch({ type: SHOW_LINK_IN_PROGRESS });
    }

    try {
      const data = provisioner.prepareLinkData(options);
      await accountManager.registerSecondDevice(data);
      window.IPC.removeSetupMenuItems();
    } catch (error) {
      if (error instanceof HTTPError) {
        switch (error.code) {
          case 409:
            dispatch({
              type: SET_ERROR,
              payload: InstallScreenError.TooOld,
            });
            return;
          case 411:
            dispatch({
              type: SET_ERROR,
              payload: InstallScreenError.TooManyDevices,
            });
            return;
          default:
            break;
        }
      }

      dispatch({
        type: SET_QR_CODE_ERROR,
        payload: InstallScreenQRCodeError.Unknown,
      });
      return;
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
          'installer/finishInstall: error clearing database',
          Errors.toLogFormat(error)
        );
      }
    }
  };
}

function showBackupImport(): ShowBackupImportActionType {
  return { type: SHOW_BACKUP_IMPORT };
}

function showLinkInProgress(): ShowLinkInProgressActionType {
  return { type: SHOW_LINK_IN_PROGRESS };
}

function updateBackupImportProgress(
  payload: UpdateBackupImportProgressActionType['payload']
): UpdateBackupImportProgressActionType {
  return { type: UPDATE_BACKUP_IMPORT_PROGRESS, payload };
}

function retryBackupImport(): ThunkAction<
  void,
  RootStateType,
  unknown,
  RetryBackupImportActionType
> {
  return dispatch => {
    dispatch({ type: RETRY_BACKUP_IMPORT });
    backupsService.retryDownload();
  };
}

// Reducer

export function getEmptyState(): InstallerStateType {
  return {
    step: InstallScreenStep.NotStarted,
  };
}

export function reducer(
  state: Readonly<InstallerStateType> = getEmptyState(),
  action: Readonly<InstallerActionType>
): InstallerStateType {
  if (action.type === START_INSTALLER) {
    // Abort previous install
    if (state.step === InstallScreenStep.QrCodeNotScanned) {
      const controller = controllerByBaton.get(state.baton);
      controller?.abort();
    }

    return {
      step: InstallScreenStep.QrCodeNotScanned,
      provisioningUrl: {
        loadingState: LoadingState.Loading,
      },
      baton: action.payload,
      attemptCount:
        state.step === InstallScreenStep.QrCodeNotScanned
          ? state.attemptCount + 1
          : 0,
    };
  }

  if (action.type === SET_PROVISIONING_URL) {
    if (
      state.step !== InstallScreenStep.QrCodeNotScanned ||
      state.provisioningUrl.loadingState !== LoadingState.Loading
    ) {
      log.warn('ducks/installer: not setting provisioning url', state.step);
      return state;
    }

    return {
      ...state,
      provisioningUrl: {
        loadingState: LoadingState.Loaded,
        value: action.payload,
      },
    };
  }

  if (action.type === SET_QR_CODE_ERROR) {
    if (
      state.step !== InstallScreenStep.QrCodeNotScanned ||
      state.provisioningUrl.loadingState !== LoadingState.Loading
    ) {
      log.warn('ducks/installer: not setting qr code error', state.step);
      return state;
    }

    return {
      ...state,
      provisioningUrl: {
        loadingState: LoadingState.LoadFailed,
        error: action.payload,
      },
    };
  }

  if (action.type === SET_ERROR) {
    return {
      step: InstallScreenStep.Error,
      error: action.payload,
    };
  }

  if (action.type === QR_CODE_SCANNED) {
    if (
      state.step !== InstallScreenStep.QrCodeNotScanned ||
      state.provisioningUrl.loadingState !== LoadingState.Loaded
    ) {
      log.warn('ducks/installer: not setting qr code scanned', state.step);
      return state;
    }

    return {
      step: InstallScreenStep.ChoosingDeviceName,
      deviceName: action.payload.deviceName,
      baton: action.payload.baton,
    };
  }

  if (action.type === SHOW_LINK_IN_PROGRESS) {
    if (
      // Backups not supported
      state.step !== InstallScreenStep.ChoosingDeviceName &&
      // No backup available
      state.step !== InstallScreenStep.BackupImport
    ) {
      log.warn('ducks/installer: not setting link in progress', state.step);
      return state;
    }

    return {
      step: InstallScreenStep.LinkInProgress,
    };
  }

  if (action.type === SHOW_BACKUP_IMPORT) {
    if (
      // Downloading backup after linking
      state.step !== InstallScreenStep.QrCodeNotScanned &&
      // Restarting backup download on startup
      state.step !== InstallScreenStep.NotStarted
    ) {
      log.warn('ducks/installer: not setting backup import', state.step);
      return state;
    }

    return {
      step: InstallScreenStep.BackupImport,
      backupStep: InstallScreenBackupStep.Download,
    };
  }

  if (action.type === UPDATE_BACKUP_IMPORT_PROGRESS) {
    if (state.step !== InstallScreenStep.BackupImport) {
      log.warn(
        'ducks/installer: not updating backup import progress',
        state.step
      );
      return state;
    }

    if ('error' in action.payload) {
      return {
        ...state,
        error: action.payload.error,
      };
    }

    return {
      ...state,
      backupStep: action.payload.backupStep,
      currentBytes: action.payload.currentBytes,
      totalBytes: action.payload.totalBytes,
    };
  }

  if (action.type === RETRY_BACKUP_IMPORT) {
    if (state.step !== InstallScreenStep.BackupImport) {
      log.warn(
        'ducks/installer: wrong step, not retrying backup import',
        state.step
      );
      return state;
    }

    return {
      ...state,
      error: undefined,
    };
  }

  return state;
}
