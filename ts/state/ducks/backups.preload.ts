// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, throttle } from 'lodash';
import { ipcRenderer } from 'electron';

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';

import { createLogger } from '../../logging/log.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import { getBackups, getPlaintextWorkflow } from '../selectors/backups.std.js';
import { getIntl } from '../selectors/user.std.js';
import { promptOSAuth } from '../../util/promptOSAuth.preload.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { backupsService } from '../../services/backups/index.preload.js';
import {
  NotEnoughStorageError,
  LocalExportErrors,
  PlaintextExportSteps,
  RanOutOfStorageError,
  StoragePermissionsError,
  plaintextExportValidTransitions,
  LocalBackupExportSteps,
  localBackupExportValidTransitions,
} from '../../types/LocalExport.std.js';

import type { StateType } from '../reducer.preload.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import type {
  PlaintextExportWorkflowType,
  LocalBackupExportWorkflowType,
  LocalExportErrorDetails,
} from '../../types/LocalExport.std.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import { toLogFormat } from '../../types/errors.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const log = createLogger('ducks/backups');

// State

// We expect there to be other backup workflows, but only one can be active at once
export type WorkflowContainer = ReadonlyDeep<
  | {
      type: 'plaintext-export';
      workflow: PlaintextExportWorkflowType;
    }
  | {
      type: 'local-backup';
      workflow: LocalBackupExportWorkflowType;
    }
  | undefined
>;

export type BackupsStateType = ReadonlyDeep<{
  workflow: WorkflowContainer;
}>;

function isPlaintextExportWorkflow(
  workflow: WorkflowContainer
): workflow is ReadonlyDeep<{
  type: 'plaintext-export';
  workflow: PlaintextExportWorkflowType;
}> {
  return workflow?.type === 'plaintext-export';
}

function isLocalBackupExportWorkflow(
  workflow: WorkflowContainer
): workflow is ReadonlyDeep<{
  type: 'local-backup';
  workflow: LocalBackupExportWorkflowType;
}> {
  return workflow?.type === 'local-backup';
}

// Actions

const SET_WORKFLOW = 'Backup/SET_WORKFLOW';

export type SetWorkflowAction = ReadonlyDeep<{
  type: typeof SET_WORKFLOW;
  payload: WorkflowContainer;
}>;

type BackupsActionTGype = ReadonlyDeep<SetWorkflowAction>;

// Action Creators

export const actions = {
  cancelLocalBackupWorkflow,
  cancelWorkflow,
  clearWorkflow,
  setWorkflow,
  startLocalBackupExport,
  startPlaintextExport,
  verifyWithOSForExport,
};

export const useBackupActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Generally this won't be used directly
function setWorkflow(payload: WorkflowContainer): SetWorkflowAction {
  return {
    type: SET_WORKFLOW,
    payload,
  };
}

function clearWorkflow(): SetWorkflowAction {
  return {
    type: SET_WORKFLOW,
    payload: undefined,
  };
}

// Local Backup Export Actions

export function startLocalBackupExport(): ThunkAction<
  void,
  StateType,
  unknown,
  SetWorkflowAction
> {
  return async (dispatch, getState) => {
    const state = getBackups(getState());
    if (state.workflow != null) {
      log.error(
        `startLocalBackupExport: Cannot start, workflow is already ${state.workflow.type}/${state.workflow.workflow.step}`
      );
      return;
    }

    const localBackupFolder = itemStorage.get('localBackupFolder');
    if (!localBackupFolder) {
      log.error('startLocalBackupExport: Cannot start, no backup folder set');
      return;
    }

    const abortController = new AbortController();
    dispatch({
      type: SET_WORKFLOW,
      payload: {
        type: 'local-backup',
        workflow: {
          step: LocalBackupExportSteps.ExportingMessages,
          abortController,
          localBackupFolder,
        },
      },
    });

    try {
      let complete = false;
      const onProgress = throttle(
        (currentBytes: number, totalBytes: number) => {
          if (complete) {
            return;
          }
          if (abortController.signal.aborted) {
            return;
          }

          dispatch({
            type: SET_WORKFLOW,
            payload: {
              type: 'local-backup',
              workflow: {
                step: LocalBackupExportSteps.ExportingAttachments,
                abortController,
                progress: {
                  currentBytes,
                  totalBytes,
                },
                localBackupFolder,
              },
            },
          });
        },
        200,
        { leading: true, trailing: true }
      );

      const { snapshotDir } = await backupsService.exportLocalBackup({
        backupsBaseDir: localBackupFolder,
        abortSignal: abortController.signal,
        onProgress,
      });

      complete = true;

      if (abortController.signal.aborted) {
        dispatch(clearWorkflow());
        return;
      }

      await itemStorage.put('lastLocalBackup', {
        timestamp: Date.now(),
        backupsFolder: localBackupFolder,
        snapshotDir,
      });

      dispatch({
        type: SET_WORKFLOW,
        payload: {
          type: 'local-backup',
          workflow: {
            step: LocalBackupExportSteps.Complete,
            localBackupFolder,
          },
        },
      });
    } catch (error) {
      log.warn('startLocalBackupExport:', toLogFormat(error));

      if (abortController.signal.aborted) {
        dispatch(clearWorkflow());
        return;
      }

      let errorDetails: LocalExportErrorDetails = {
        type: LocalExportErrors.General,
      };

      if (error instanceof NotEnoughStorageError) {
        errorDetails = {
          type: LocalExportErrors.NotEnoughStorage,
          bytesNeeded: error.bytesNeeded,
        };
      }
      if (error instanceof RanOutOfStorageError) {
        errorDetails = {
          type: LocalExportErrors.RanOutOfStorage,
          bytesNeeded: error.bytesNeeded,
        };
      }
      if (error instanceof StoragePermissionsError) {
        errorDetails = {
          type: LocalExportErrors.StoragePermissions,
        };
      }

      dispatch({
        type: SET_WORKFLOW,
        payload: {
          type: 'local-backup',
          workflow: {
            step: LocalBackupExportSteps.Error,
            errorDetails,
          },
        },
      });
    }
  };
}

function cancelLocalBackupWorkflow(): ThunkAction<
  void,
  StateType,
  unknown,
  SetWorkflowAction
> {
  return async (dispatch, getState) => {
    const state = getBackups(getState());
    const { workflow } = state;

    if (workflow?.type !== 'local-backup') {
      log.error(
        `cancelLocalBackupWorkflow: Cannot cancel, workflow type is ${workflow?.type}`
      );
      return;
    }

    const { step } = workflow.workflow;
    if (
      step !== LocalBackupExportSteps.ExportingMessages &&
      step !== LocalBackupExportSteps.ExportingAttachments
    ) {
      log.error(
        `cancelLocalBackupWorkflow: Cannot cancel, previous state is ${step}`
      );
      return;
    }

    const { abortController } = workflow.workflow;
    abortController.abort();

    dispatch(clearWorkflow());
  };
}

// Plaintext Export Actions

function startPlaintextExport(): ThunkAction<
  void,
  StateType,
  unknown,
  SetWorkflowAction
> {
  return async (dispatch, getState) => {
    const state = getBackups(getState());
    if (state.workflow != null) {
      log.error(
        `startPlaintextExport: Cannot start, workflow is already ${state.workflow.type}/${state.workflow.workflow.step}`
      );
      return;
    }

    dispatch({
      type: SET_WORKFLOW,
      payload: {
        type: 'plaintext-export',
        workflow: {
          step: PlaintextExportSteps.ConfirmingExport,
        },
      },
    });
  };
}

export function verifyWithOSForExport(
  includeMedia: boolean
): ThunkAction<void, StateType, unknown, SetWorkflowAction> {
  return async (dispatch, getState) => {
    const previousWorkflow = getPlaintextWorkflow(getState());
    if (
      !previousWorkflow ||
      previousWorkflow.step !== PlaintextExportSteps.ConfirmingExport
    ) {
      log.error(
        `verifyWithOSForExport: Cannot start, previous state is ${previousWorkflow?.step}`
      );
      return;
    }

    dispatch({
      type: SET_WORKFLOW,
      payload: {
        type: 'plaintext-export',
        workflow: {
          step: PlaintextExportSteps.ConfirmingWithOS,
          includeMedia,
        },
      },
    });

    const result = await promptOSAuth('plaintext-export');
    switch (result) {
      case 'success':
        chooseExportLocation()(dispatch, getState, null);
        break;
      case 'unauthorized-no-windows-ucv':
      case 'unsupported':
      case 'error':
        log.warn(
          `verifyWithOSForExport: Got '${result}' status, but continuing on`
        );
        chooseExportLocation()(dispatch, getState, null);
        break;
      case 'unauthorized':
        log.warn('verifyWithOSForExport: Not authorized; clearing workflow');
        dispatch(clearWorkflow());
        break;
      default:
        throw missingCaseError(result);
    }
  };
}

function chooseExportLocation(): ThunkAction<
  void,
  StateType,
  unknown,
  SetWorkflowAction
> {
  return async (dispatch, getState) => {
    const previousWorkflow = getPlaintextWorkflow(getState());
    if (
      !previousWorkflow ||
      previousWorkflow.step !== PlaintextExportSteps.ConfirmingWithOS
    ) {
      log.error(
        `chooseExportLocation: Cannot start, previous state is ${previousWorkflow?.step}`
      );
      return;
    }
    dispatch({
      type: SET_WORKFLOW,
      payload: {
        type: 'plaintext-export',
        workflow: {
          step: PlaintextExportSteps.ChoosingLocation,
          includeMedia: previousWorkflow.includeMedia,
        },
      },
    });

    const i18n = getIntl(getState());
    const result = await showExportLocationChooser(i18n);

    if (result.canceled || !result.dirPath) {
      dispatch(clearWorkflow());
    } else {
      doPlaintextExport(result.dirPath)(dispatch, getState, null);
    }
  };
}

function doPlaintextExport(
  exportPath: string
): ThunkAction<void, StateType, unknown, SetWorkflowAction> {
  return async (dispatch, getState) => {
    const previousWorkflow = getPlaintextWorkflow(getState());
    if (
      !previousWorkflow ||
      previousWorkflow.step !== PlaintextExportSteps.ChoosingLocation
    ) {
      log.error(
        `doPlaintextExport: Cannot start, previous state is ${previousWorkflow?.step}`
      );
      return;
    }

    const { includeMedia } = previousWorkflow;

    const abortController = new AbortController();
    dispatch({
      type: SET_WORKFLOW,
      payload: {
        type: 'plaintext-export',
        workflow: {
          step: PlaintextExportSteps.ExportingMessages,
          abortController,
          exportPath,
        },
      },
    });

    try {
      let complete = false;
      const onProgress = debounce(
        (currentBytes, totalBytes) => {
          if (complete) {
            return;
          }
          if (abortController.signal.aborted) {
            return;
          }

          dispatch({
            type: SET_WORKFLOW,
            payload: {
              type: 'plaintext-export',
              workflow: {
                step: PlaintextExportSteps.ExportingAttachments,
                abortController,
                progress: {
                  currentBytes,
                  totalBytes,
                },
                exportPath,
              },
            },
          });
        },
        200,
        { leading: true, trailing: true, maxWait: 200 }
      );

      const result = await backupsService.exportPlaintext({
        abortSignal: abortController.signal,
        onProgress,
        shouldIncludeMedia: includeMedia,
        targetPath: exportPath,
      });
      complete = true;

      if (abortController.signal.aborted) {
        dispatch(clearWorkflow());
        return;
      }

      dispatch({
        type: SET_WORKFLOW,
        payload: {
          type: 'plaintext-export',
          workflow: {
            step: PlaintextExportSteps.Complete,
            exportPath: result.snapshotDir || exportPath,
          },
        },
      });
    } catch (error) {
      log.warn('doPlaintextExport:', toLogFormat(error));

      if (abortController.signal.aborted) {
        dispatch(clearWorkflow());
        return;
      }

      let errorDetails: LocalExportErrorDetails = {
        type: LocalExportErrors.General,
      };

      if (error instanceof NotEnoughStorageError) {
        errorDetails = {
          type: LocalExportErrors.NotEnoughStorage,
          bytesNeeded: error.bytesNeeded,
        };
      }
      if (error instanceof RanOutOfStorageError) {
        errorDetails = {
          type: LocalExportErrors.RanOutOfStorage,
          bytesNeeded: error.bytesNeeded,
        };
      }
      if (error instanceof StoragePermissionsError) {
        errorDetails = {
          type: LocalExportErrors.StoragePermissions,
        };
      }

      dispatch({
        type: SET_WORKFLOW,
        payload: {
          type: 'plaintext-export',
          workflow: {
            step: PlaintextExportSteps.Error,
            errorDetails,
          },
        },
      });
    }
  };
}

function cancelWorkflow(): ThunkAction<
  void,
  StateType,
  unknown,
  SetWorkflowAction
> {
  return async (dispatch, getState) => {
    const previousWorkflow = getPlaintextWorkflow(getState());
    if (
      !previousWorkflow ||
      (previousWorkflow.step !== PlaintextExportSteps.ExportingMessages &&
        previousWorkflow.step !== PlaintextExportSteps.ExportingAttachments)
    ) {
      log.error(
        `cancelWorkflow: Cannot cancel, previous state is ${previousWorkflow?.step}`
      );
      return;
    }

    const { abortController } = previousWorkflow;
    abortController.abort();

    dispatch(clearWorkflow());
  };
}

function showExportLocationChooser(i18n: LocalizerType): Promise<{
  canceled: boolean;
  dirPath?: string;
}> {
  return ipcRenderer.invoke('show-open-folder-dialog', {
    useMainWindow: true,
    title: i18n('icu:SaveMultiDialog__title'),
    buttonLabel: i18n('icu:save'),
  });
}

// Reducer

export function getEmptyState(): BackupsStateType {
  return {
    workflow: undefined,
  };
}

export function reducer(
  state: BackupsStateType = getEmptyState(),
  action: BackupsActionTGype
): BackupsStateType {
  if (action.type === SET_WORKFLOW) {
    const { payload } = action;

    const existing = state.workflow;
    const next = payload;

    // Prevent switching between different workflow types
    if (existing && next && existing.type !== next.type) {
      log.error(
        `backups/SET_WORKFLOW: Cannot switch from ${existing.type} to ${next.type}`
      );
      return state;
    }

    // Validate plaintext-export transitions
    if (
      isPlaintextExportWorkflow(existing) &&
      isPlaintextExportWorkflow(next)
    ) {
      const existingStep = existing.workflow.step;
      const newStep = next.workflow.step;
      if (!plaintextExportValidTransitions[existingStep].has(newStep)) {
        log.error(
          `backups/SET_WORKFLOW: Invalid plaintext transition ${existingStep} to ${newStep}`
        );
        return state;
      }
    }

    // Validate local-backup transitions
    if (
      isLocalBackupExportWorkflow(existing) &&
      isLocalBackupExportWorkflow(next)
    ) {
      const existingStep = existing.workflow.step;
      const newStep = next.workflow.step;
      if (!localBackupExportValidTransitions[existingStep].has(newStep)) {
        log.error(
          `backups/SET_WORKFLOW: Invalid local-encrypted transition ${existingStep} to ${newStep}`
        );
        return state;
      }
    }

    return {
      ...state,
      workflow: action.payload,
    };
  }

  return state;
}
