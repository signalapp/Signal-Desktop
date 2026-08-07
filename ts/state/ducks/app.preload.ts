// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer.preload.ts';
import { createLogger } from '../../logging/log.std.ts';
import { AppViewType } from '../../types/app.std.ts';
import { getEnvironment, Environment } from '../../environment.std.ts';
import {
  START_INSTALLER,
  type StartInstallerActionType,
  SHOW_BACKUP_IMPORT,
  type ShowBackupImportActionType,
  cancelInstall,
} from './installer.preload.ts';
import { startRegistration } from './standaloneInstaller.preload.ts';

const log = createLogger('app');

// State

export type AppStateType = ReadonlyDeep<{
  hasInitialLoadCompleted: boolean;
  appView: AppViewType;
}>;

// Actions

const INITIAL_LOAD_COMPLETE = 'app/INITIAL_LOAD_COMPLETE';
const OPEN_INBOX = 'app/OPEN_INBOX';
const OPEN_STANDALONE = 'app/OPEN_STANDALONE';

type InitialLoadCompleteActionType = ReadonlyDeep<{
  type: typeof INITIAL_LOAD_COMPLETE;
}>;

export type OpenInboxActionType = ReadonlyDeep<{
  type: typeof OPEN_INBOX;
}>;

type OpenStandaloneActionType = ReadonlyDeep<{
  type: typeof OPEN_STANDALONE;
}>;

export type AppActionType = ReadonlyDeep<
  InitialLoadCompleteActionType | OpenInboxActionType | OpenStandaloneActionType
>;

export const actions = {
  initialLoadComplete,
  openInbox,
  openStandalone,
};

function initialLoadComplete(): InitialLoadCompleteActionType {
  return {
    type: INITIAL_LOAD_COMPLETE,
  };
}

export function openInbox(): ThunkAction<
  Promise<void>,
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

function openStandalone(
  startFromBeginning = true
): ThunkAction<
  Promise<void>,
  RootStateType,
  unknown,
  OpenStandaloneActionType
> {
  return async (dispatch, getState) => {
    if (!window.SignalCI && getEnvironment() === Environment.PackagedApp) {
      log.warn(
        `openStandalone: refusing because environment is ${getEnvironment()}`
      );
      return;
    }

    cancelInstall()(dispatch, getState, undefined);

    window.IPC.addSetupMenuItems();

    if (startFromBeginning) {
      await startRegistration()(dispatch, getState, undefined);
    }

    dispatch({
      type: OPEN_STANDALONE,
    });
  };
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
  action: Readonly<
    AppActionType | StartInstallerActionType | ShowBackupImportActionType
  >
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

  if (action.type === OPEN_STANDALONE) {
    return {
      ...state,
      appView: AppViewType.Standalone,
    };
  }

  // Foreign action
  if (action.type === START_INSTALLER || action.type === SHOW_BACKUP_IMPORT) {
    return {
      ...state,
      appView: AppViewType.Installer,
    };
  }

  return state;
}
