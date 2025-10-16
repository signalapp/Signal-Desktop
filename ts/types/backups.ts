// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BackupLevel } from '@signalapp/libsignal-client/dist/zkgroup/index.js';
import { BackupCredentialType } from '@signalapp/libsignal-client/dist/zkgroup/index.js';
import type { GetBackupCDNCredentialsResponseType } from '../textsecure/WebAPI.preload.js';

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

export type SubscriptionCostType = {
  amount: number;
  currencyCode: string;
};

export type BackupStatusType = {
  createdTimestamp?: number;
  protoSize?: number;
};

export type BackupMediaDownloadStatusType = {
  totalBytes: number;
  completedBytes: number;
  isPaused: boolean;
  isIdle: boolean;
};

export type BackupsSubscriptionType = (
  | {
      status: 'not-found' | 'expired';
    }
  | (
      | {
          status: 'active';
          renewalTimestamp?: number;
          cost?: SubscriptionCostType;
        }
      | {
          status: 'pending-cancellation';
          expiryTimestamp?: number;
          cost?: SubscriptionCostType;
        }
    )
) & { lastFetchedAtMs?: number; isFetching?: boolean };

export type LocalBackupMetadataVerificationType = {
  snapshotDir: string;
  backupId: Uint8Array;
  metadataKey: Uint8Array;
};
