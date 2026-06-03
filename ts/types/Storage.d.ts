// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorageAccessType } from './StorageKeys.std.ts';

export type { StorageAccessType } from './StorageKeys.std.ts';
import type { GroupCredentialType } from '../textsecure/WebAPI.preload.js';
import type {
  SessionResetsType,
  StorageServiceCredentials,
} from '../textsecure/Types.d.ts';
import type {
  BackupCredentialWrapperType,
  BackupsSubscriptionType,
  BackupStatusType,
} from './backups.node.js';
import type { ServiceIdString } from './ServiceId.std.js';
import type { RegisteredChallengeType } from '../challenge.dom.js';
import type { ServerAlertsType } from '../util/handleServerAlerts.preload.js';
import type { NotificationProfileOverride } from './NotificationProfile.std.js';
import type { PhoneNumberSharingMode } from './PhoneNumberSharingMode.std.js';
import type { LocalBackupExportMetadata } from './LocalExport.std.js';

export type AutoDownloadAttachmentType = {
  photos: boolean;
  videos: boolean;
  audio: boolean;
  documents: boolean;
};

export type SerializedCertificateType = {
  expires: number;
  serialized: Uint8Array;
};

export type ZoomFactorType = 0.75 | 1 | 1.25 | 1.5 | 2 | number;

export type SentMediaQualitySettingType = 'standard' | 'high';

export type NotificationSettingType = 'message' | 'name' | 'count' | 'off';

export type IdentityKeyMap = Record<
  ServiceIdString,
  {
    privKey: Uint8Array;
    pubKey: Uint8Array;
  }
>;

export type StorageInterface = {
  onready: (callback: () => void) => void;

  get<K extends keyof StorageAccessType, V extends StorageAccessType[K]>(
    key: K
  ): V | undefined;
  get<K extends keyof StorageAccessType, V extends StorageAccessType[K]>(
    key: K,
    defaultValue: V
  ): V;

  put: <K extends keyof StorageAccessType>(
    key: K,
    value: StorageAccessType[K]
  ) => Promise<void>;

  remove: <K extends keyof StorageAccessType>(key: K) => Promise<void>;
};
