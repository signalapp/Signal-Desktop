// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CustomColorsItemType,
  DefaultConversationColorType,
} from './Colors';
import type { AudioDevice } from './Calling';
import type { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import type { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import type { RetryItemType } from '../util/retryPlaceholders';
import type { ConfigMapType as RemoteConfigType } from '../RemoteConfig';

import type { GroupCredentialType } from '../textsecure/WebAPI';
import type {
  KeyPairType,
  SessionResetsType,
  StorageServiceCredentials,
} from '../textsecure/Types.d';

export type SerializedCertificateType = {
  expires: number;
  serialized: ArrayBuffer;
};

export type StorageAccessType = {
  'always-relay-calls': boolean;
  'audio-notification': boolean;
  'badge-count-muted-conversations': boolean;
  'blocked-groups': Array<string>;
  'blocked-uuids': Array<string>;
  'call-ringtone-notification': boolean;
  'call-system-notification': boolean;
  'hide-menu-bar': boolean;
  'incoming-call-notification': boolean;
  'notification-draw-attention': boolean;
  'notification-setting': 'message' | 'name' | 'count' | 'off';
  'read-receipt-setting': boolean;
  'spell-check': boolean;
  'theme-setting': 'light' | 'dark' | 'system';
  attachmentMigration_isComplete: boolean;
  attachmentMigration_lastProcessedIndex: number;
  blocked: Array<string>;
  defaultConversationColor: DefaultConversationColorType;
  customColors: CustomColorsItemType;
  device_name: string;
  hasRegisterSupportForUnauthenticatedDelivery: boolean;
  identityKey: KeyPairType;
  lastHeartbeat: number;
  lastStartup: number;
  lastAttemptedToRefreshProfilesAt: number;
  maxPreKeyId: number;
  number_id: string;
  password: string;
  profileKey: ArrayBuffer;
  regionCode: string;
  registrationId: number;
  remoteBuildExpiration: number;
  sessionResets: SessionResetsType;
  showStickerPickerHint: boolean;
  showStickersIntroduction: boolean;
  signedKeyId: number;
  signedKeyRotationRejected: number;
  storageKey: string;
  synced_at: number;
  userAgent: string;
  uuid_id: string;
  version: string;
  linkPreviews: boolean;
  universalExpireTimer: number;
  retryPlaceholders: Array<RetryItemType>;
  chromiumRegistrationDoneEver: '';
  chromiumRegistrationDone: '';
  phoneNumberSharingMode: PhoneNumberSharingMode;
  phoneNumberDiscoverability: PhoneNumberDiscoverability;
  pinnedConversationIds: Array<string>;
  primarySendsSms: boolean;
  typingIndicators: boolean;
  sealedSenderIndicators: boolean;
  storageFetchComplete: boolean;
  avatarUrl: string;
  manifestVersion: number;
  storageCredentials: StorageServiceCredentials;
  'storage-service-error-records': Array<{
    itemType: number;
    storageID: string;
  }>;
  'storage-service-unknown-records': Array<{
    itemType: number;
    storageID: string;
  }>;
  'preferred-video-input-device': string;
  'preferred-audio-input-device': AudioDevice;
  'preferred-audio-output-device': AudioDevice;
  remoteConfig: RemoteConfigType;
  unidentifiedDeliveryIndicators: boolean;
  groupCredentials: Array<GroupCredentialType>;
  lastReceivedAtCounter: number;
  signaling_key: ArrayBuffer;
  skinTone: number;
  unreadCount: number;
  'challenge:retry-message-ids': ReadonlyArray<{
    messageId: string;
    createdAt: number;
  }>;
  deviceNameEncrypted: boolean;
  'indexeddb-delete-needed': boolean;
  senderCertificate: SerializedCertificateType;
  senderCertificateNoE164: SerializedCertificateType;

  // Deprecated
  senderCertificateWithUuid: never;
};

export interface StorageInterface {
  onready(callback: () => void): void;

  get<K extends keyof StorageAccessType, V extends StorageAccessType[K]>(
    key: K
  ): V | undefined;

  get<K extends keyof StorageAccessType, V extends StorageAccessType[K]>(
    key: K,
    defaultValue: V
  ): V;

  put<K extends keyof StorageAccessType>(
    key: K,
    value: StorageAccessType[K]
  ): Promise<void>;

  remove<K extends keyof StorageAccessType>(key: K): Promise<void>;
}
