// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import type Long from 'long';

export class UnsupportedBackupVersion extends Error {
  constructor(version: Long) {
    super(`Unsupported backup version: ${version}`);
  }
}

export class BackupDownloadFailedError extends Error {}

export class BackupProcessingError extends Error {}

export class BackupImportCanceledError extends Error {}

export class RelinkRequestedError extends Error {}
