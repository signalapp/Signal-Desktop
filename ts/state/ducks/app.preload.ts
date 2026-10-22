// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import { createLogger } from '../../logging/log.std.ts';
import { AppViewType } from '../../types/app.std.ts';
import { getEnvironment } from '../../environment.std.ts';
import {
  START_INSTALLER,
  SHOW_BACKUP_IMPORT,
  cancelInstall,
} from './installer.preload.ts';
import {
  cancelRegistration,
  startRegistration,
} from './standaloneInstaller.preload.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import { isStandaloneEnabled } from '../../types/StandaloneRegistration.std.ts';

import type { CancelWorkflowActionType } from './standaloneInstaller.preload.ts';
import type { AsyncStateThunk } from '../types.std.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import type {
  StartInstallerActionType,
  ShowBackupImportActionType,
  CancelInstallerActionType,
} from './installer.preload.ts';

const log = createLogger('app');

// State

export type AppStateType = ReadonlyDeep<{
  hasInitialLoadCompleted: boolean;
  appView: AppViewType;
}>;

// Actions

const INITIAL_LOAD_COMPLETE = 'app/INITIAL_LOAD_COMPLETE';
const OPEN_ENTRY_POINT = 'app/OPEN_ENTRY_POINT';
const OPEN_INBOX = 'app/OPEN_INBOX';
const OPEN_STANDALONE = 'app/OPEN_STANDALONE';

type InitialLoadCompleteActionType = ReadonlyDeep<{
  type: typeof INITIAL_LOAD_COMPLETE;
}>;

export type OpenEntryPointActionType = ReadonlyDeep<{
  type: typeof OPEN_ENTRY_POINT;
}>;

export type OpenInboxActionType = ReadonlyDeep<{
  type: typeof OPEN_INBOX;
}>;

type OpenStandaloneActionType = ReadonlyDeep<{
  type: typeof OPEN_STANDALONE;
}>;

export type AppActionType = ReadonlyDeep<
  | InitialLoadCompleteActionType
  | OpenEntryPointActionType
  | OpenInboxActionType
  | OpenStandaloneActionType
>;

export const actions = {
  initialLoadComplete,
  openEntryPoint,
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

function openEntryPoint(): AsyncStateThunk<
  | OpenEntryPointActionType
  | CancelWorkflowActionType
  | CancelInstallerActionType
> {
  return async dispatch => {
    log.info('open entrypoint');

    dispatch({
      type: OPEN_ENTRY_POINT,
    });

    // Eagerly cancel standalone and link operations - starting one will cancel the other,
    // but this starts that process early.
    dispatch(cancelInstall());
    dispatch(cancelRegistration());
  };
}

export function openInbox(): AsyncStateThunk<OpenInboxActionType> {
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
): AsyncStateThunk<OpenStandaloneActionType> {
  return async dispatch => {
    if (!isStandaloneEnabled(window.getVersion())) {
      log.warn(
        `openStandalone: refusing because feature is not enabled: ${getEnvironment()}`
      );
      return;
    }

    dispatch(cancelInstall());

    window.IPC.addSetupMenuItems();

    if (startFromBeginning) {
      await dispatch(startRegistration());
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

  if (action.type === OPEN_ENTRY_POINT) {
    return {
      ...state,
      appView: AppViewType.EntryPoint,
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
