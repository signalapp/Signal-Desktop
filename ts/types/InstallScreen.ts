// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum InstallScreenStep {
  NotStarted = 'NotStarted',
  QrCodeNotScanned = 'QrCodeNotScanned',
  Error = 'Error',

  // Either of these two is the final state
  LinkInProgress = 'LinkInProgress',
  BackupImport = 'BackupImport',
}

export enum InstallScreenBackupStep {
  WaitForBackup = 'WaitForBackup',
  Download = 'Download',
  Process = 'Process',
}

export enum InstallScreenBackupError {
  UnsupportedVersion = 'UnsupportedVersion',
  Retriable = 'Retriable',
  Fatal = 'Fatal',
  Canceled = 'Canceled',
}

export enum InstallScreenError {
  TooManyDevices = 'TooManyDevices',
  TooOld = 'TooOld',
  ConnectionFailed = 'ConnectionFailed',
  QRCodeFailed = 'QRCodeFailed',
}

export enum InstallScreenQRCodeError {
  MaxRotations = 'MaxRotations',
  Timeout = 'Timeout',
  Unknown = 'Unknown',
  NetworkIssue = 'NetworkIssue',
}

// This is the string's `.length`, which is the number of UTF-16 code points. Instead, we
//   want this to be either 50 graphemes or 256 encrypted bytes, whichever is smaller. See
//   DESKTOP-2844.
export const MAX_DEVICE_NAME_LENGTH = 50;
