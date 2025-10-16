// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import type Long from 'long';

import { InstallScreenBackupError } from '../../types/InstallScreen.std.js';

export class BackupInstallerError extends Error {
  constructor(
    name: string,
    public readonly installerError: InstallScreenBackupError
  ) {
    super(name);
  }
}

export class UnsupportedBackupVersion extends BackupInstallerError {
  constructor(version: Long) {
    super(
      `Unsupported backup version: ${version}`,
      InstallScreenBackupError.UnsupportedVersion
    );
  }
}

export class BackupDownloadFailedError extends BackupInstallerError {
  constructor() {
    super('BackupDownloadFailedError', InstallScreenBackupError.Retriable);
  }
}

export class BackupProcessingError extends BackupInstallerError {
  constructor(cause: Error) {
    super('BackupProcessingError', InstallScreenBackupError.Fatal);

    this.cause = cause;
  }
}

export class BackupImportCanceledError extends BackupInstallerError {
  constructor() {
    super('BackupImportCanceledError', InstallScreenBackupError.Canceled);
  }
}

export class RelinkRequestedError extends BackupInstallerError {
  constructor() {
    super('RelinkRequestedError', InstallScreenBackupError.Fatal);
  }
}
