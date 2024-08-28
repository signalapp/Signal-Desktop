// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import * as log from '../../logging/log';

// State

export enum AppViewType {
  Blank = 'Blank',
  Inbox = 'Inbox',
  Installer = 'Installer',
  Standalone = 'Standalone',
  BackupImport = 'BackupImport',
}

export type AppStateType = ReadonlyDeep<
  {
    hasInitialLoadCompleted: boolean;
  } & (
    | {
        appView: AppViewType.Blank;
      }
    | {
        appView: AppViewType.Inbox;
      }
    | {
        appView: AppViewType.Installer;
      }
    | {
        appView: AppViewType.Standalone;
      }
    | {
        appView: AppViewType.BackupImport;
        currentBytes?: number;
        totalBytes?: number;
      }
  )
>;

// Actions

const INITIAL_LOAD_COMPLETE = 'app/INITIAL_LOAD_COMPLETE';
const OPEN_INBOX = 'app/OPEN_INBOX';
const OPEN_INSTALLER = 'app/OPEN_INSTALLER';
const OPEN_STANDALONE = 'app/OPEN_STANDALONE';
const OPEN_BACKUP_IMPORT = 'app/OPEN_BACKUP_IMPORT';
const UPDATE_BACKUP_IMPORT_PROGRESS = 'app/UPDATE_BACKUP_IMPORT_PROGRESS';

type InitialLoadCompleteActionType = ReadonlyDeep<{
  type: typeof INITIAL_LOAD_COMPLETE;
}>;

type OpenInboxActionType = ReadonlyDeep<{
  type: typeof OPEN_INBOX;
}>;

type OpenInstallerActionType = ReadonlyDeep<{
  type: typeof OPEN_INSTALLER;
}>;

type OpenStandaloneActionType = ReadonlyDeep<{
  type: typeof OPEN_STANDALONE;
}>;

type OpenBackupImportActionType = ReadonlyDeep<{
  type: typeof OPEN_BACKUP_IMPORT;
}>;

type UpdateBackupImportProgressActionType = ReadonlyDeep<{
  type: typeof UPDATE_BACKUP_IMPORT_PROGRESS;
  payload: {
    currentBytes: number;
    totalBytes: number;
  };
}>;

export type AppActionType = ReadonlyDeep<
  | InitialLoadCompleteActionType
  | OpenInboxActionType
  | OpenInstallerActionType
  | OpenStandaloneActionType
  | OpenBackupImportActionType
  | UpdateBackupImportProgressActionType
>;

export const actions = {
  initialLoadComplete,
  openInbox,
  openInstaller,
  openStandalone,
  openBackupImport,
  updateBackupImportProgress,
};

export const useAppActions = (): BoundActionCreatorsMapObject<typeof actions> =>
  useBoundActions(actions);

function initialLoadComplete(): InitialLoadCompleteActionType {
  return {
    type: INITIAL_LOAD_COMPLETE,
  };
}

function openInbox(): ThunkAction<
  void,
  RootStateType,
  unknown,
  OpenInboxActionType
> {
  return async dispatch => {
    log.info('open inbox');

    await window.ConversationController.load();

    dispatch({
      type: OPEN_INBOX,
    });
  };
}

function openInstaller(): ThunkAction<
  void,
  RootStateType,
  unknown,
  OpenInstallerActionType
> {
  return dispatch => {
    window.IPC.addSetupMenuItems();

    dispatch({
      type: OPEN_INSTALLER,
    });
  };
}

function openStandalone(): ThunkAction<
  void,
  RootStateType,
  unknown,
  OpenStandaloneActionType
> {
  return dispatch => {
    if (window.getEnvironment() === 'production') {
      return;
    }

    window.IPC.addSetupMenuItems();
    dispatch({
      type: OPEN_STANDALONE,
    });
  };
}

function openBackupImport(): OpenBackupImportActionType {
  return { type: OPEN_BACKUP_IMPORT };
}

function updateBackupImportProgress(
  payload: UpdateBackupImportProgressActionType['payload']
): UpdateBackupImportProgressActionType {
  return { type: UPDATE_BACKUP_IMPORT_PROGRESS, payload };
}

// Reducer

export function getEmptyState(): AppStateType {
  return {
    appView: AppViewType.Blank,
    hasInitialLoadCompleted: false,
  };
}

export function reducer(
  state: Readonly<AppStateType> = getEmptyState(),
  action: Readonly<AppActionType>
): AppStateType {
  if (action.type === OPEN_INBOX) {
    return {
      ...state,
      appView: AppViewType.Inbox,
    };
  }

  if (action.type === INITIAL_LOAD_COMPLETE) {
    return {
      ...state,
      hasInitialLoadCompleted: true,
    };
  }

  if (action.type === OPEN_INSTALLER) {
    return {
      ...state,
      appView: AppViewType.Installer,
    };
  }

  if (action.type === OPEN_STANDALONE) {
    return {
      ...state,
      appView: AppViewType.Standalone,
    };
  }

  if (action.type === OPEN_BACKUP_IMPORT) {
    return {
      ...state,
      appView: AppViewType.BackupImport,
    };
  }

  if (action.type === UPDATE_BACKUP_IMPORT_PROGRESS) {
    if (state.appView !== AppViewType.BackupImport) {
      return state;
    }

    return {
      ...state,
      currentBytes: action.payload.currentBytes,
      totalBytes: action.payload.totalBytes,
    };
  }

  return state;
}
