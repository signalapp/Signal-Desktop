// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

/**
 * Shared types/errors (plaintext & encrypted)
 */
export enum LocalExportErrors {
  General = 'General',
  NotEnoughStorage = 'NotEnoughStorage',
  RanOutOfStorage = 'RanOutOfStorage',
  StoragePermissions = 'StoragePermissions',
}

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

export type LocalExportErrorDetails =
  | {
      type: LocalExportErrors.General;
    }
  | {
      type: LocalExportErrors.NotEnoughStorage;
      bytesNeeded: number;
    }
  | {
      type: LocalExportErrors.RanOutOfStorage;
      bytesNeeded: number;
    }
  | {
      type: LocalExportErrors.StoragePermissions;
    };

export type LocalExportProgress =
  | {
      totalBytes: number;
      currentBytes: number;
    }
  | undefined;

/**
 *  LocalBackupExport types
 */
export enum LocalBackupExportSteps {
  ExportingMessages = 'ExportingMessages',
  ExportingAttachments = 'ExportingAttachments',
  Complete = 'Complete',
  Error = 'Error',
}

export type LocalBackupExportMetadata = {
  timestamp: number;
  backupsFolder: string;
  snapshotDir: string;
};

export type LocalBackupExportWorkflowType =
  | {
      step: LocalBackupExportSteps.ExportingMessages;
      abortController: AbortController;
      localBackupFolder: string;
    }
  | {
      step: LocalBackupExportSteps.ExportingAttachments;
      abortController: AbortController;
      progress: LocalExportProgress;
      localBackupFolder: string;
    }
  | {
      step: LocalBackupExportSteps.Complete;
      localBackupFolder: string;
    }
  | {
      step: LocalBackupExportSteps.Error;
      errorDetails: LocalExportErrorDetails;
    };

export const localBackupExportValidTransitions: {
  [key in LocalBackupExportSteps]: Set<LocalBackupExportSteps>;
} = {
  [LocalBackupExportSteps.ExportingMessages]: new Set([
    LocalBackupExportSteps.Complete,
    LocalBackupExportSteps.Error,
    LocalBackupExportSteps.ExportingAttachments,
  ]),
  [LocalBackupExportSteps.ExportingAttachments]: new Set([
    // When updating progress, we transition to the same step with new progress
    LocalBackupExportSteps.ExportingAttachments,
    LocalBackupExportSteps.Complete,
    LocalBackupExportSteps.Error,
  ]),
  // Terminal states
  [LocalBackupExportSteps.Complete]: new Set([]),
  [LocalBackupExportSteps.Error]: new Set([]),
};

/**
 *  PlaintextExport types
 */
export enum PlaintextExportSteps {
  ConfirmingExport = 'ConfirmingExport',
  ChoosingLocation = 'ChoosingLocation',
  ConfirmingWithOS = 'ConfirmingWithOS',
  ExportingMessages = 'ExportingMessages',
  ExportingAttachments = 'ExportingAttachments',
  Complete = 'Complete',
  Error = 'Error',
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
      exportPath: string;
    }
  | {
      // We automatically transition from ExportingMessages to ExportingAttachments when
      // our onProgress callback is first called.
      step: PlaintextExportSteps.ExportingAttachments;
      abortController: AbortController;
      progress: LocalExportProgress;
      exportPath: string;
    }
  | {
      step: PlaintextExportSteps.Complete;
      exportPath: string;
    }
  | {
      // Not a normal step: Something went wrong, and we need to show error to the user
      step: PlaintextExportSteps.Error;
      errorDetails: LocalExportErrorDetails;
    };

// We can cancel in all states, but only need Canceling when we were actively exporting
export const plaintextExportValidTransitions: {
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
