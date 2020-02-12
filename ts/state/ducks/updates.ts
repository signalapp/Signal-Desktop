import { Dialogs } from '../../types/Dialogs';
import * as updateIpc from '../../shims/updateIpc';

// State

export type UpdatesStateType = {
  dialogType: Dialogs;
};

// Actions

const ACK_RENDER = 'updates/ACK_RENDER';
const DISMISS_DIALOG = 'updates/DISMISS_DIALOG';
const SHOW_UPDATE_DIALOG = 'updates/SHOW_UPDATE_DIALOG';
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

type StartUpdateAction = {
  type: 'updates/START_UPDATE';
};

export type UpdatesActionType =
  | AckRenderAction
  | DismissDialogAction
  | ShowUpdateDialogAction
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
  startUpdate,
};

// Reducer

function getEmptyState(): UpdatesStateType {
  return {
    dialogType: Dialogs.None,
  };
}

export function reducer(
  state: UpdatesStateType = getEmptyState(),
  action: UpdatesActionType
): UpdatesStateType {
  if (action.type === SHOW_UPDATE_DIALOG) {
    return {
      dialogType: action.payload,
    };
  }

  if (
    action.type === DISMISS_DIALOG &&
    state.dialogType === Dialogs.MacOS_Read_Only
  ) {
    return {
      dialogType: Dialogs.None,
    };
  }

  return state;
}
