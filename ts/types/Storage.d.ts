// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from 'ringrtc';
import type {
  CustomColorsItemType,
  DefaultConversationColorType,
} from './Colors';
import type { AudioDeviceModule } from '../calling/audioDeviceModule';
import type { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import type { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import type { RetryItemType } from '../util/retryPlaceholders';
import type { ConfigMapType as RemoteConfigType } from '../RemoteConfig';
import type { SystemTraySetting } from './SystemTraySetting';
import type { ExtendedStorageID, UnknownRecord } from './StorageService';

import type { GroupCredentialType } from '../textsecure/WebAPI';
import type {
  SessionResetsType,
  StorageServiceCredentials,
} from '../textsecure/Types.d';
import type { ThemeSettingType } from './StorageUIKeys';

import { RegisteredChallengeType } from '../challenge';

export type SerializedCertificateType = {
  expires: number;
  serialized: Uint8Array;
};

export type ZoomFactorType = 0.75 | 1 | 1.25 | 1.5 | 2 | number;

export type NotificationSettingType = 'message' | 'name' | 'count' | 'off';

export type IdentityKeyMap = Record<
  string,
  {
    privKey: Uint8Array;
    pubKey: Uint8Array;
  }
>;

// This should be in sync with `STORAGE_UI_KEYS` in `ts/types/StorageUIKeys.ts`.
export type StorageAccessType = {
  'always-relay-calls': boolean;
  'audio-notification': boolean;
  'auto-download-update': boolean;
  'badge-count-muted-conversations': boolean;
  'blocked-groups': Array<string>;
  'blocked-uuids': Array<string>;
  'call-ringtone-notification': boolean;
  'call-system-notification': boolean;
  'hide-menu-bar': boolean;
  'system-tray-setting': SystemTraySetting;
  'incoming-call-notification': boolean;
  'notification-draw-attention': boolean;
  'notification-setting': NotificationSettingType;
  'read-receipt-setting': boolean;
  'spell-check': boolean;
  'theme-setting': ThemeSettingType;
  attachmentMigration_isComplete: boolean;
  attachmentMigration_lastProcessedIndex: number;
  blocked: Array<string>;
  defaultConversationColor: DefaultConversationColorType;
  customColors: CustomColorsItemType;
  device_name: string;
  hasRegisterSupportForUnauthenticatedDelivery: boolean;
  hasStoriesEnabled: boolean;
  identityKeyMap: IdentityKeyMap;
  lastHeartbeat: number;
  lastStartup: number;
  lastAttemptedToRefreshProfilesAt: number;
  maxPreKeyId: number;
  number_id: string;
  password: string;
  profileKey: Uint8Array;
  regionCode: string;
  registrationIdMap: Record<string, number>;
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
  pni: string;
  version: string;
  linkPreviews: boolean;
  universalExpireTimer: number;
  retryPlaceholders: Array<RetryItemType>;
  chromiumRegistrationDoneEver: '';
  chromiumRegistrationDone: '';
  phoneNumberSharingMode: PhoneNumberSharingMode;
  phoneNumberDiscoverability: PhoneNumberDiscoverability;
  pinnedConversationIds: Array<string>;
  preferContactAvatars: boolean;
  primarySendsSms: boolean;
  // Unlike `number_id` (which also includes device id) this field is only
  // updated whenever we receive a new storage manifest
  accountE164: string;
  typingIndicators: boolean;
  sealedSenderIndicators: boolean;
  storageFetchComplete: boolean;
  avatarUrl: string | undefined;
  manifestVersion: number;
  storageCredentials: StorageServiceCredentials;
  'storage-service-error-records': Array<UnknownRecord>;
  'storage-service-unknown-records': Array<UnknownRecord>;
  'storage-service-pending-deletes': Array<ExtendedStorageID>;
  'preferred-video-input-device': string;
  'preferred-audio-input-device': AudioDevice;
  'preferred-audio-output-device': AudioDevice;
  previousAudioDeviceModule: AudioDeviceModule;
  remoteConfig: RemoteConfigType;
  unidentifiedDeliveryIndicators: boolean;
  groupCredentials: Array<GroupCredentialType>;
  lastReceivedAtCounter: number;
  preferredReactionEmoji: Array<string>;
  skinTone: number;
  unreadCount: number;
  'challenge:conversations': ReadonlyArray<RegisteredChallengeType>;

  deviceNameEncrypted: boolean;
  'indexeddb-delete-needed': boolean;
  senderCertificate: SerializedCertificateType;
  senderCertificateNoE164: SerializedCertificateType;
  paymentAddress: string;
  zoomFactor: ZoomFactorType;
  preferredLeftPaneWidth: number;
  nextSignedKeyRotationTime: number;
  areWeASubscriber: boolean;
  subscriberId: Uint8Array;
  subscriberCurrencyCode: string;
  displayBadgesOnProfile: boolean;
  keepMutedChatsArchived: boolean;
  hasAllStoriesMuted: boolean;

  // Deprecated
  senderCertificateWithUuid: never;
  signaling_key: never;
  'challenge:retry-message-ids': never;
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
