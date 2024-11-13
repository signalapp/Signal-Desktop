// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum InstallScreenStep {
  NotStarted = 'NotStarted',
  QrCodeNotScanned = 'QrCodeNotScanned',
  ChoosingDeviceName = 'ChoosingDeviceName',
  Error = 'Error',

  // Either of these two is the final state
  LinkInProgress = 'LinkInProgress',
  BackupImport = 'BackupImport',
}

export enum InstallScreenBackupStep {
  Download = 'Download',
  Process = 'Process',
}

export enum InstallScreenBackupError {
  Unknown = 'Unknown',
  UnsupportedVersion = 'UnsupportedVersion',
}

export enum InstallScreenError {
  TooManyDevices = 'TooManyDevices',
  TooOld = 'TooOld',
  ConnectionFailed = 'ConnectionFailed',
  QRCodeFailed = 'QRCodeFailed',
  InactiveTimeout = 'InactiveTimeout',
}

export enum InstallScreenQRCodeError {
  Timeout = 'Timeout',
  Unknown = 'Unknown',
  NetworkIssue = 'NetworkIssue',
}

// This is the string's `.length`, which is the number of UTF-16 code points. Instead, we
//   want this to be either 50 graphemes or 256 encrypted bytes, whichever is smaller. See
//   DESKTOP-2844.
export const MAX_DEVICE_NAME_LENGTH = 50;
