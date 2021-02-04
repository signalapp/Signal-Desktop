// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Dialogs } from '../../types/Dialogs';
import * as updateIpc from '../../shims/updateIpc';
import { trigger } from '../../shims/events';

// State

export type UpdatesStateType = {
  dialogType: Dialogs;
  didSnooze: boolean;
  showEventsCount: number;
};

// Actions

const ACK_RENDER = 'updates/ACK_RENDER';
const DISMISS_DIALOG = 'updates/DISMISS_DIALOG';
const SHOW_UPDATE_DIALOG = 'updates/SHOW_UPDATE_DIALOG';
const SNOOZE_UPDATE = 'updates/SNOOZE_UPDATE';
const START_UPDATE = 'updates/START_UPDATE';

type AckRenderAction = {
  type: 'updates/ACK_RENDER';
};

type DismissDialogAction = {
  type: 'updates/DISMISS_DIALOG';
};

export type ShowUpdateDialogAction = {
  type: 'updates/SHOW_UPDATE_DIALOG';
  payload: Dialogs;
};

type SnoozeUpdateActionType = {
  type: 'updates/SNOOZE_UPDATE';
};

type StartUpdateAction = {
  type: 'updates/START_UPDATE';
};

export type UpdatesActionType =
  | AckRenderAction
  | DismissDialogAction
  | ShowUpdateDialogAction
  | SnoozeUpdateActionType
  | StartUpdateAction;

// Action Creators

function ackRender(): AckRenderAction {
  updateIpc.ackRender();

  return {
    type: ACK_RENDER,
  };
}

function dismissDialog(): DismissDialogAction {
  return {
    type: DISMISS_DIALOG,
  };
}

function showUpdateDialog(dialogType: Dialogs): ShowUpdateDialogAction {
  return {
    type: SHOW_UPDATE_DIALOG,
    payload: dialogType,
  };
}

const SNOOZE_TIMER = 60 * 1000 * 30;

function snoozeUpdate(): SnoozeUpdateActionType {
  setTimeout(() => {
    trigger('snooze-update');
  }, SNOOZE_TIMER);

  return {
    type: SNOOZE_UPDATE,
  };
}

function startUpdate(): StartUpdateAction {
  updateIpc.startUpdate();

  return {
    type: START_UPDATE,
  };
}

export const actions = {
  ackRender,
  dismissDialog,
  showUpdateDialog,
  snoozeUpdate,
  startUpdate,
};

// Reducer

function getEmptyState(): UpdatesStateType {
  return {
    dialogType: Dialogs.None,
    didSnooze: false,
    showEventsCount: 0,
  };
}

export function reducer(
  state: Readonly<UpdatesStateType> = getEmptyState(),
  action: Readonly<UpdatesActionType>
): UpdatesStateType {
  if (action.type === SHOW_UPDATE_DIALOG) {
    return {
      dialogType: action.payload,
      didSnooze: state.didSnooze,
      showEventsCount: state.showEventsCount + 1,
    };
  }

  if (action.type === SNOOZE_UPDATE) {
    return {
      dialogType: Dialogs.None,
      didSnooze: true,
      showEventsCount: state.showEventsCount,
    };
  }

  if (action.type === START_UPDATE) {
    return {
      dialogType: Dialogs.None,
      didSnooze: state.didSnooze,
      showEventsCount: state.showEventsCount,
    };
  }

  if (
    action.type === DISMISS_DIALOG &&
    state.dialogType === Dialogs.MacOS_Read_Only
  ) {
    return {
      dialogType: Dialogs.None,
      didSnooze: state.didSnooze,
      showEventsCount: state.showEventsCount,
    };
  }

  return state;
}
