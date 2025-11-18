// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';
import { ipcRenderer } from 'electron';

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';

import { createLogger } from '../../logging/log.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import { getBackups, getWorkflow } from '../selectors/backups.std.js';
import { getIntl } from '../selectors/user.std.js';
import { promptOSAuth } from '../../util/promptOSAuth.preload.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { backupsService } from '../../services/backups/index.preload.js';
import {
  NotEnoughStorageError,
  PlaintextExportErrors,
  PlaintextExportSteps,
  RanOutOfStorageError,
  StoragePermissionsError,
  validTransitions,
} from '../../types/Backups.std.js';

import type { StateType } from '../reducer.preload.js';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import type {
  PlaintextExportErrorDetails,
  PlaintextExportWorkflowType,
} from '../../types/Backups.std.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import { toLogFormat } from '../../types/errors.std.js';

const log = createLogger('ducks/backups');

// State

// We expect there to be other backup workflows, but only one can be active at once
export type WorkflowContainer = ReadonlyDeep<
  | {
      type: 'plaintext-export';
      workflow: PlaintextExportWorkflowType;
    }
  | undefined
>;

export type BackupsStateType = ReadonlyDeep<{
  workflow: WorkflowContainer;
}>;

// Actions

const SET_WORKFLOW = 'Backup/SET_WORKFLOW';

export type SetWorkflowAction = ReadonlyDeep<{
  type: typeof SET_WORKFLOW;
  payload: WorkflowContainer;
}>;

type BackupsActionTGype = ReadonlyDeep<SetWorkflowAction>;

// Action Creators

export const actions = {
  cancelWorkflow,
  clearWorkflow,
  setWorkflow,
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
    const previousWorkflow = getWorkflow(getState());
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
    const previousWorkflow = getWorkflow(getState());
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
    const previousWorkflow = getWorkflow(getState());
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
          exportInBackground: false,
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
                exportInBackground: false,
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

      let errorDetails: PlaintextExportErrorDetails = {
        type: PlaintextExportErrors.General,
      };

      if (error instanceof NotEnoughStorageError) {
        errorDetails = {
          type: PlaintextExportErrors.NotEnoughStorage,
          bytesNeeded: error.bytesNeeded,
        };
      }
      if (error instanceof RanOutOfStorageError) {
        errorDetails = {
          type: PlaintextExportErrors.RanOutOfStorage,
          bytesNeeded: error.bytesNeeded,
        };
      }
      if (error instanceof StoragePermissionsError) {
        errorDetails = {
          type: PlaintextExportErrors.StoragePermissions,
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
    const previousWorkflow = getWorkflow(getState());
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

    const existingType = state.workflow?.type;
    const existingStep = state.workflow?.workflow?.step;
    const newType = payload?.type;
    const newStep = payload?.workflow?.step;
    if (
      existingStep &&
      newStep &&
      existingType === 'plaintext-export' &&
      newType === 'plaintext-export'
    ) {
      if (!validTransitions[existingStep].has(newStep)) {
        log.error(
          `backups/SET_WORKFLOW: Invalid transition ${existingStep} to ${newStep}`
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
