// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { InstallScreenBackupError } from '../../types/InstallScreen.std.ts';

export class BackupInstallerError extends Error {
  public readonly installerError: InstallScreenBackupError;

  constructor(name: string, installerError: InstallScreenBackupError) {
    super(name);
    this.installerError = installerError;
  }
}

// oxlint-disable-next-line max-classes-per-file
export class UnsupportedBackupVersion extends BackupInstallerError {
  constructor(version: bigint) {
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
