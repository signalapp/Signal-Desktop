// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

export enum PlaintextExportSteps {
  ConfirmingExport = 'ConfirmingExport',
  ChoosingLocation = 'ChoosingLocation',
  ConfirmingWithOS = 'ConfirmingWithOS',
  ExportingMessages = 'ExportingMessages',
  ExportingAttachments = 'ExportingAttachments',
  Complete = 'Complete',

  Error = 'Error',
}

export type ExportProgress =
  | {
      totalBytes: number;
      currentBytes: number;
    }
  | undefined;

export enum PlaintextExportErrors {
  General = 'General',
  NotEnoughStorage = 'NotEnoughStorage',
  RanOutOfStorage = 'RanOutOfStorage',
  StoragePermissions = 'StoragePermissions',
}

export type PlaintextExportErrorDetails =
  | {
      type: PlaintextExportErrors.General;
    }
  | {
      type: PlaintextExportErrors.NotEnoughStorage;
      bytesNeeded: number;
    }
  | {
      type: PlaintextExportErrors.RanOutOfStorage;
      bytesNeeded: number;
    }
  | {
      type: PlaintextExportErrors.StoragePermissions;
    };

export class NotEnoughStorageError extends Error {
  constructor(public readonly bytesNeeded: number) {
    super('NotEnoughStorageError');
  }
}
export class RanOutOfStorageError extends Error {
  constructor(public readonly bytesNeeded: number) {
    super('RanOutOfStorageError');
  }
}
export class StoragePermissionsError extends Error {
  constructor() {
    super('StoragePermissionsError');
  }
}

export type PlaintextExportWorkflowType =
  | {
      step: PlaintextExportSteps.ConfirmingExport;
    }
  | {
      step: PlaintextExportSteps.ConfirmingWithOS;
      includeMedia: boolean;
    }
  | {
      step: PlaintextExportSteps.ChoosingLocation;
      includeMedia: boolean;
    }
  | {
      step: PlaintextExportSteps.ExportingMessages;
      abortController: AbortController;
      exportInBackground: boolean;
      exportPath: string;
    }
  | {
      // We automatically transition from ExportingMessages to ExportingAttachments when
      // our onProgress callback is first called.
      step: PlaintextExportSteps.ExportingAttachments;
      abortController: AbortController;
      exportInBackground: boolean;
      progress: ExportProgress;
      exportPath: string;
    }
  | {
      step: PlaintextExportSteps.Complete;
      exportPath: string;
    }
  | {
      // Not a normal step: Something went wrong, and we need to show error to the user
      step: PlaintextExportSteps.Error;
      errorDetails: PlaintextExportErrorDetails;
    };

// We can cancel in all states, but only need Canceling when we were actively exporting
export const validTransitions: {
  [key in PlaintextExportSteps]: Set<PlaintextExportSteps>;
} = {
  [PlaintextExportSteps.ConfirmingExport]: new Set([
    PlaintextExportSteps.ConfirmingWithOS,
  ]),
  [PlaintextExportSteps.ConfirmingWithOS]: new Set([
    PlaintextExportSteps.ChoosingLocation,
  ]),
  [PlaintextExportSteps.ChoosingLocation]: new Set([
    PlaintextExportSteps.ExportingMessages,
  ]),
  [PlaintextExportSteps.ExportingMessages]: new Set([
    PlaintextExportSteps.Complete,
    PlaintextExportSteps.Error,
    PlaintextExportSteps.ExportingAttachments,
  ]),
  [PlaintextExportSteps.ExportingAttachments]: new Set([
    // When updating progress, we transition to the same step, new progress
    PlaintextExportSteps.ExportingAttachments,
    PlaintextExportSteps.Complete,
    PlaintextExportSteps.Error,
  ]),
  // All three of these are terminal states
  [PlaintextExportSteps.Complete]: new Set([]),
  [PlaintextExportSteps.Error]: new Set([]),
};
