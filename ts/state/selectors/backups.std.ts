// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer.preload.js';
import type { BackupsStateType } from '../ducks/backups.preload.js';
import type {
  PlaintextExportWorkflowType,
  LocalBackupExportWorkflowType,
} from '../../types/LocalExport.std.js';

export const getBackups = (state: StateType): BackupsStateType => state.backups;

export const shouldShowPlaintextWorkflow = createSelector(
  getBackups,
  (backups: BackupsStateType): boolean => {
    const workflow = backups.workflow?.workflow;
    const isPlaintextExport = backups.workflow?.type === 'plaintext-export';

    if (!isPlaintextExport || !workflow) {
      return false;
    }

    return true;
  }
);

export const getPlaintextWorkflow = createSelector(
  getBackups,
  (backups: BackupsStateType): PlaintextExportWorkflowType | undefined => {
    if (backups.workflow?.type !== 'plaintext-export') {
      return undefined;
    }
    return backups.workflow.workflow;
  }
);

export const shouldShowLocalBackupWorkflow = createSelector(
  getBackups,
  (backups: BackupsStateType): boolean => {
    return backups.workflow?.type === 'local-backup';
  }
);

export const getLocalBackupWorkflow = createSelector(
  getBackups,
  (backups: BackupsStateType): LocalBackupExportWorkflowType | undefined => {
    if (backups.workflow?.type !== 'local-backup') {
      return undefined;
    }
    return backups.workflow.workflow;
  }
);
