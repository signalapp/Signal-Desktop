// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import * as log from '../../logging/log';
import { getEnvironment, Environment } from '../../environment';
import {
  START_INSTALLER,
  type StartInstallerActionType,
  SHOW_BACKUP_IMPORT,
  type ShowBackupImportActionType,
} from './installer';

// State

export enum AppViewType {
  Blank = 'Blank',
  Inbox = 'Inbox',
  Installer = 'Installer',
  Standalone = 'Standalone',
}

export type AppStateType = ReadonlyDeep<{
  hasInitialLoadCompleted: boolean;
  appView: AppViewType;
}>;

// Actions

const INITIAL_LOAD_COMPLETE = 'app/INITIAL_LOAD_COMPLETE';
const OPEN_INBOX = 'app/OPEN_INBOX';
export const OPEN_INSTALLER = 'app/OPEN_INSTALLER';
const OPEN_STANDALONE = 'app/OPEN_STANDALONE';

type InitialLoadCompleteActionType = ReadonlyDeep<{
  type: typeof INITIAL_LOAD_COMPLETE;
}>;

type OpenInboxActionType = ReadonlyDeep<{
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

function openStandalone(): ThunkAction<
  void,
  RootStateType,
  unknown,
  OpenStandaloneActionType
> {
  return dispatch => {
    if (getEnvironment() === Environment.PackagedApp) {
      return;
    }

    window.IPC.addSetupMenuItems();
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
