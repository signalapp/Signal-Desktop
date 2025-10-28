// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';

import type { StateType as RootStateType } from '../reducer.preload.js';
import {
  type InstallScreenBackupError,
  InstallScreenBackupStep,
  InstallScreenStep,
  InstallScreenError,
  InstallScreenQRCodeError,
} from '../../types/InstallScreen.std.js';
import * as Errors from '../../types/errors.std.js';
import { type Loadable, LoadingState } from '../../util/loadable.std.js';
import { isRecord } from '../../util/isRecord.std.js';
import { strictAssert } from '../../util/assert.std.js';
import * as Registration from '../../util/registration.preload.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { HTTPError } from '../../types/HTTPError.std.js';
import {
  Provisioner,
  EventKind as ProvisionEventKind,
  type EnvelopeType as ProvisionEnvelopeType,
} from '../../textsecure/Provisioner.preload.js';
import { accountManager } from '../../textsecure/AccountManager.preload.js';
import { getProvisioningResource } from '../../textsecure/WebAPI.preload.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import { createLogger } from '../../logging/log.std.js';
import { backupsService } from '../../services/backups/index.preload.js';
import OS from '../../util/os/osMain.node.js';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.js';

const log = createLogger('installer');

export type BatonType = ReadonlyDeep<{ __installer_baton: never }>;

const cancelByBaton = new WeakMap<BatonType, () => void>();
let provisioner: Provisioner | undefined;

export type InstallerStateType = ReadonlyDeep<
  | {
      step: InstallScreenStep.NotStarted;
    }
  | {
      step: InstallScreenStep.QrCodeNotScanned;
      provisioningUrl: Loadable<string, InstallScreenQRCodeError>;
      baton: BatonType;
    }
  | {
      step: InstallScreenStep.Error;
      error: InstallScreenError;
    }
  | {
      step: InstallScreenStep.LinkInProgress;
    }
  | ({
      step: InstallScreenStep.BackupImport;
      backupStep: InstallScreenBackupStep;
      error?: InstallScreenBackupError;
    } & (
      | {
          backupStep:
            | InstallScreenBackupStep.Download
            | InstallScreenBackupStep.Process;
          currentBytes: number;
          totalBytes: number;
        }
      | {
          backupStep: InstallScreenBackupStep.WaitForBackup;
        }
    ))
>;

export type RetryBackupImportValue = ReadonlyDeep<'retry' | 'cancel'>;

export const START_INSTALLER = 'installer/START_INSTALLER';
const SET_PROVISIONING_URL = 'installer/SET_PROVISIONING_URL';
const SET_QR_CODE_ERROR = 'installer/SET_QR_CODE_ERROR';
const SET_ERROR = 'installer/SET_ERROR';
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
  handleMissingBackup,
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

    if (!provisioner) {
      provisioner = new Provisioner({
        server: {
          getProvisioningResource,
        },
      });
    }

    const cancel = provisioner.subscribe(event => {
      if (event.kind === ProvisionEventKind.MaxRotationsError) {
        log.warn('InstallScreen/getQRCode: max rotations reached');
        dispatch({
          type: SET_QR_CODE_ERROR,
          payload: InstallScreenQRCodeError.MaxRotations,
        });
      } else if (event.kind === ProvisionEventKind.TimeoutError) {
        if (event.canRetry) {
          log.warn('InstallScreen/getQRCode: timed out');
          dispatch({
            type: SET_QR_CODE_ERROR,
            payload: InstallScreenQRCodeError.Timeout,
          });
        } else {
          log.error('InstallScreen/getQRCode: too many tries');
          dispatch({
            type: SET_ERROR,
            payload: InstallScreenError.QRCodeFailed,
          });
        }
      } else if (event.kind === ProvisionEventKind.ConnectError) {
        const { error } = event;

        log.error(
          'got an error while waiting for QR code',
          Errors.toLogFormat(error)
        );

        if (
          error instanceof HTTPError &&
          error.code === -1 &&
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
      } else if (event.kind === ProvisionEventKind.EnvelopeError) {
        log.error(
          'got an error while waiting for envelope',
          Errors.toLogFormat(event.error)
        );

        dispatch({
          type: SET_QR_CODE_ERROR,
          payload: InstallScreenQRCodeError.Unknown,
        });
      } else if (event.kind === ProvisionEventKind.URL) {
        window.SignalCI?.setProvisioningURL(event.url);
        dispatch({
          type: SET_PROVISIONING_URL,
          payload: event.url,
        });
      } else if (event.kind === ProvisionEventKind.Envelope) {
        const { envelope } = event;
        const defaultDeviceName = OS.getName() || 'Signal Desktop';

        if (event.isLinkAndSync) {
          dispatch(
            finishInstall({
              envelope,
              deviceName: defaultDeviceName,
              isLinkAndSync: true,
            })
          );
        } else {
          const { SignalCI } = window;
          const deviceName =
            SignalCI != null ? SignalCI.deviceName : defaultDeviceName;
          dispatch(
            finishInstall({
              envelope,
              deviceName,
              isLinkAndSync: false,
            })
          );
        }
      } else {
        throw missingCaseError(event);
      }
    });

    cancelByBaton.set(baton, cancel);
  };
}

type FinishInstallOptionsType = ReadonlyDeep<{
  isLinkAndSync: boolean;
  deviceName: string;
  envelope?: ProvisionEnvelopeType;
}>;

function finishInstall({
  isLinkAndSync,
  envelope: providedEnvelope,
  deviceName,
}: FinishInstallOptionsType): ThunkAction<
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
      provisioner != null,
      'Provisioner is not waiting for device info'
    );

    let envelope: ProvisionEnvelopeType;
    if (state.installer.step === InstallScreenStep.QrCodeNotScanned) {
      strictAssert(
        providedEnvelope != null,
        'finishInstall: missing required envelope'
      );
      envelope = providedEnvelope;
    } else {
      throw new Error('Wrong step');
    }

    // Cleanup
    const { baton } = state.installer;
    cancelByBaton.get(baton)?.();
    cancelByBaton.delete(baton);

    if (isLinkAndSync) {
      dispatch({ type: SHOW_BACKUP_IMPORT });
    } else {
      dispatch({ type: SHOW_LINK_IN_PROGRESS });
    }

    try {
      await accountManager.registerSecondDevice(
        Provisioner.prepareLinkData({
          envelope,
          deviceName,
        })
      );
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
        await signalProtocolStore.removeAllData();
      } catch (error) {
        log.error(
          'finishInstall: error clearing database',
          Errors.toLogFormat(error)
        );
      }
    }
  };
}

function showBackupImport(): ShowBackupImportActionType {
  return { type: SHOW_BACKUP_IMPORT };
}

function handleMissingBackup(): ShowLinkInProgressActionType {
  // If backup is missing, go to normal link-in-progress view
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
      const cancel = cancelByBaton.get(state.baton);
      cancel?.();
    } else {
      // Reset qr code fetch attempt count when starting from scratch
      provisioner?.reset();
    }

    return {
      step: InstallScreenStep.QrCodeNotScanned,
      provisioningUrl: {
        loadingState: LoadingState.Loading,
      },
      baton: action.payload,
    };
  }

  if (action.type === SET_PROVISIONING_URL) {
    if (
      state.step !== InstallScreenStep.QrCodeNotScanned ||
      (state.provisioningUrl.loadingState !== LoadingState.Loading &&
        // Rotating
        state.provisioningUrl.loadingState !== LoadingState.Loaded)
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
      !(
        state.provisioningUrl.loadingState === LoadingState.Loading ||
        // Rotating
        state.provisioningUrl.loadingState === LoadingState.Loaded
      )
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

  if (action.type === SHOW_LINK_IN_PROGRESS) {
    if (
      // Classic linking
      state.step !== InstallScreenStep.QrCodeNotScanned &&
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
      backupStep: InstallScreenBackupStep.WaitForBackup,
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
