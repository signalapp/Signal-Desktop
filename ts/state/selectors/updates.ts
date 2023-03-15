// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { DialogType } from '../../types/Dialogs';

import type { StateType } from '../reducer';
import type { UpdatesStateType } from '../ducks/updates';

const getUpdatesState = (state: Readonly<StateType>): UpdatesStateType =>
  state.updates;

export const isUpdateDialogVisible = createSelector(
  getUpdatesState,
  ({ dialogType, didSnooze }) => {
    if (dialogType === DialogType.None) {
      return false;
    }

    // Displayed as UnsupportedOSDialog in LeftPane
    if (dialogType === DialogType.UnsupportedOS) {
      return false;
    }

    if (didSnooze) {
      return false;
    }

    return true;
  }
);

export const isUpdateDownloaded = createSelector(
  getUpdatesState,
  ({ dialogType }) =>
    dialogType === DialogType.AutoUpdate ||
    dialogType === DialogType.DownloadedUpdate
);

export const isOSUnsupported = createSelector(
  getUpdatesState,
  ({ dialogType }) => dialogType === DialogType.UnsupportedOS
);
