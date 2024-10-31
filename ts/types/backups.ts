// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { BackupCredentialType } from '@signalapp/libsignal-client/dist/zkgroup';
import type { GetBackupCDNCredentialsResponseType } from '../textsecure/WebAPI';

export { BackupCredentialType };

export type BackupCredentialWrapperType = Readonly<{
  type: BackupCredentialType;
  credential: string;
  level: BackupLevel;
  redemptionTimeMs: number;
}>;

export type BackupPresentationHeadersType = Readonly<{
  'X-Signal-ZK-Auth': string;
  'X-Signal-ZK-Auth-Signature': string;
}>;

export type BackupSignedPresentationType = Readonly<{
  headers: BackupPresentationHeadersType;
  level: BackupLevel;
}>;

export type BackupCdnReadCredentialType = Readonly<{
  credentials: Readonly<GetBackupCDNCredentialsResponseType>;
  retrievedAtMs: number;
  cdnNumber: number;
}>;
