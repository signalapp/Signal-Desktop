// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type { DialogType } from '../types/Dialogs.std.js';
import type {
  UpdateDialogOptionsType,
  ShowUpdateDialogActionType,
} from '../state/ducks/updates.preload.js';

type UpdatesActions = {
  showUpdateDialog: (
    x: DialogType,
    options: UpdateDialogOptionsType
  ) => ShowUpdateDialogActionType;
};

export function initializeUpdateListener(updatesActions: UpdatesActions): void {
  ipcRenderer.on(
    'show-update-dialog',
    (_, dialogType: DialogType, options: UpdateDialogOptionsType = {}) => {
      updatesActions.showUpdateDialog(dialogType, options);
    }
  );
}
