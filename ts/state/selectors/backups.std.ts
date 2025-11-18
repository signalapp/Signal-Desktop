// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { PlaintextExportSteps } from '../../types/Backups.std.js';

import type { StateType } from '../reducer.preload.js';
import type { BackupsStateType } from '../ducks/backups.preload.js';
import type { PlaintextExportWorkflowType } from '../../types/Backups.std.js';

export const getBackups = (state: StateType): BackupsStateType => state.backups;

export const shouldShowPlaintextWorkflow = createSelector(
  getBackups,
  (backups: BackupsStateType): boolean => {
    const workflow = backups.workflow?.workflow;
    const isPlaintextExport = backups.workflow?.type === 'plaintext-export';

    if (!isPlaintextExport || !workflow) {
      return false;
    }

    if (
      (workflow.step === PlaintextExportSteps.ExportingAttachments ||
        workflow.step === PlaintextExportSteps.ExportingMessages) &&
      workflow.exportInBackground === true
    ) {
      return false;
    }

    return true;
  }
);

export const getWorkflow = createSelector(
  getBackups,
  (backups: BackupsStateType): PlaintextExportWorkflowType | undefined => {
    return backups.workflow?.workflow;
  }
);
