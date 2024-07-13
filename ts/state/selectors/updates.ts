// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { DialogType } from '../../types/Dialogs';

import type { StateType } from '../reducer';
import type { UpdatesStateType } from '../ducks/updates';

export const getUpdatesState = (state: Readonly<StateType>): UpdatesStateType =>
  state.updates;

export const getUpdateDialogType = createSelector(
  getUpdatesState,
  ({ dialogType }) => dialogType
);

export const getUpdateVersion = createSelector(
  getUpdatesState,
  ({ version }) => version
);

export const getUpdateDownloadSize = createSelector(
  getUpdatesState,
  ({ downloadSize }) => downloadSize
);

export const getUpdateDownloadedSize = createSelector(
  getUpdatesState,
  ({ downloadedSize }) => downloadedSize
);

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

export const getHasPendingUpdate = createSelector(
  getUpdatesState,
  ({ didSnooze }) => didSnooze === true
);
