// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from '@signalapp/ringrtc';
import type {
  CustomColorsItemType,
  DefaultConversationColorType,
} from './Colors';
import type { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import type { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import type { RetryItemType } from '../util/retryPlaceholders';
import type { ConfigMapType as RemoteConfigType } from '../RemoteConfig';
import type { ExtendedStorageID, UnknownRecord } from './StorageService.d';

import type { GroupCredentialType } from '../textsecure/WebAPI';
import type {
  SessionResetsType,
  StorageServiceCredentials,
} from '../textsecure/Types.d';
import type { BackupCredentialWrapperType } from './backups';
import type { ServiceIdString } from './ServiceId';

import type { RegisteredChallengeType } from '../challenge';

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

// This should be in sync with `STORAGE_UI_KEYS` in `ts/types/StorageUIKeys.ts`.

export type StorageAccessType = {
  'always-relay-calls': boolean;
  'audio-notification': boolean;
  'auto-download-update': boolean;
  autoConvertEmoji: boolean;
  'badge-count-muted-conversations': boolean;
  'blocked-groups': ReadonlyArray<string>;
  'blocked-uuids': ReadonlyArray<ServiceIdString>;
  'call-ringtone-notification': boolean;
  'call-system-notification': boolean;
  'hide-menu-bar': boolean;
  'incoming-call-notification': boolean;
  'notification-draw-attention': boolean;
  'notification-setting': NotificationSettingType;
  'read-receipt-setting': boolean;
  'sent-media-quality': SentMediaQualitySettingType;
  audioMessage: boolean;
  attachmentMigration_isComplete: boolean;
  attachmentMigration_lastProcessedIndex: number;
  blocked: ReadonlyArray<string>;
  defaultConversationColor: DefaultConversationColorType;

  // Not used UI, stored as is when imported from backup.
  defaultWallpaperPhotoPointer: Uint8Array;
  defaultWallpaperPreset: number;
  defaultDimWallpaperInDarkMode: boolean;
  defaultAutoBubbleColor: boolean;

  customColors: CustomColorsItemType;
  device_name: string;
  existingOnboardingStoryMessageIds: ReadonlyArray<string> | undefined;
  hasSetMyStoriesPrivacy: boolean;
  hasCompletedUsernameOnboarding: boolean;
  hasCompletedUsernameLinkOnboarding: boolean;
  hasCompletedSafetyNumberOnboarding: boolean;
  hasSeenGroupStoryEducationSheet: boolean;
  hasViewedOnboardingStory: boolean;
  hasStoriesDisabled: boolean;
  storyViewReceiptsEnabled: boolean | undefined;
  identityKeyMap: IdentityKeyMap;
  lastAttemptedToRefreshProfilesAt: number;
  lastResortKeyUpdateTime: number;
  lastResortKeyUpdateTimePNI: number;
  localDeleteWarningShown: boolean;
  accountEntropyPool: string;
  masterKey: string;

  accountEntropyPoolLastRequestTime: number;
  maxPreKeyId: number;
  maxPreKeyIdPNI: number;
  maxKyberPreKeyId: number;
  maxKyberPreKeyIdPNI: number;
  number_id: string;
  password: string;
  profileKey: Uint8Array;
  regionCode: string;
  registrationIdMap: Record<ServiceIdString, number>;
  remoteBuildExpiration: number;
  sessionResets: SessionResetsType;
  showStickerPickerHint: boolean;
  showStickersIntroduction: boolean;
  signedKeyId: number;
  signedKeyIdPNI: number;
  signedKeyUpdateTime: number;
  signedKeyUpdateTimePNI: number;
  storageKey: string;
  synced_at: number;
  userAgent: string;
  uuid_id: string;
  useRingrtcAdm: boolean;
  pni: string;
  version: string;
  linkPreviews: boolean;
  universalExpireTimer: number;
  retryPlaceholders: ReadonlyArray<RetryItemType>;
  chromiumRegistrationDoneEver: '';
  chromiumRegistrationDone: '';
  phoneNumberSharingMode: PhoneNumberSharingMode;
  phoneNumberDiscoverability: PhoneNumberDiscoverability;
  pinnedConversationIds: ReadonlyArray<string>;
  preferContactAvatars: boolean;
  textFormatting: boolean;
  typingIndicators: boolean;
  sealedSenderIndicators: boolean;
  storageFetchComplete: boolean;
  avatarUrl: string | undefined;
  manifestVersion: number;
  manifestRecordIkm: Uint8Array;
  storageCredentials: StorageServiceCredentials;
  'storage-service-error-records': ReadonlyArray<UnknownRecord>;
  'storage-service-unknown-records': ReadonlyArray<UnknownRecord>;
  'storage-service-pending-deletes': ReadonlyArray<ExtendedStorageID>;
  'preferred-video-input-device': string;
  'preferred-audio-input-device': AudioDevice;
  'preferred-audio-output-device': AudioDevice;
  remoteConfig: RemoteConfigType;
  serverTimeSkew: number;
  unidentifiedDeliveryIndicators: boolean;
  groupCredentials: ReadonlyArray<GroupCredentialType>;
  callLinkAuthCredentials: ReadonlyArray<GroupCredentialType>;
  backupCombinedCredentials: ReadonlyArray<BackupCredentialWrapperType>;
  backupCombinedCredentialsLastRequestTime: number;
  backupMediaRootKey: Uint8Array;
  backupMediaDownloadTotalBytes: number;
  backupMediaDownloadCompletedBytes: number;
  backupMediaDownloadPaused: boolean;
  backupMediaDownloadBannerDismissed: boolean;
  backupMediaDownloadIdle: boolean;
  messageInsertTriggersDisabled: boolean;
  setBackupMessagesSignatureKey: boolean;
  setBackupMediaSignatureKey: boolean;
  lastReceivedAtCounter: number;
  preferredReactionEmoji: ReadonlyArray<string>;
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
  nextScheduledUpdateKeyTime: number;
  navTabsCollapsed: boolean;
  areWeASubscriber: boolean;
  subscriberId: Uint8Array;
  subscriberCurrencyCode: string;
  donorSubscriptionManuallyCancelled: boolean;
  backupsSubscriberId: Uint8Array;
  backupsSubscriberPurchaseToken: string;
  backupsSubscriberOriginalTransactionId: string;
  displayBadgesOnProfile: boolean;
  keepMutedChatsArchived: boolean;
  usernameLastIntegrityCheck: number;
  usernameCorrupted: boolean;
  usernameLinkCorrupted: boolean;
  usernameLinkColor: number;
  usernameLink: {
    entropy: Uint8Array;
    serverId: Uint8Array;
  };
  needOrphanedAttachmentCheck: boolean;
  observedCapabilities: {
    deleteSync?: true;
    ssre2?: true;

    // Note: Upon capability deprecation - change the value type to `never` and
    // remove it in `ts/background.ts`
  };
  releaseNotesNextFetchTime: number;
  releaseNotesVersionWatermark: string;
  releaseNotesPreviousManifestHash: string;

  // If present - we are downloading backup
  backupDownloadPath: string;

  // If present together with backupDownloadPath - we are downloading
  // link-and-sync backup
  backupEphemeralKey: Uint8Array;

  // If present - we are resuming the download of known transfer archive
  backupTransitArchive: {
    cdn: number;
    key: string;
  };

  // If true Desktop message history was restored from backup
  isRestoredFromBackup: boolean;

  // The `firstAppVersion` present on an BackupInfo from an imported backup.
  restoredBackupFirstAppVersion: string;

  postRegistrationSyncsStatus: 'incomplete' | 'complete';

  // Deprecated
  'challenge:retry-message-ids': never;
  nextSignedKeyRotationTime: number;
  previousAudioDeviceModule: never;
  senderCertificateWithUuid: never;
  signaling_key: never;
  signedKeyRotationRejected: number;
  lastHeartbeat: never;
  lastStartup: never;
  sendEditWarningShown: never;
  formattingWarningShown: never;
  hasRegisterSupportForUnauthenticatedDelivery: never;
  masterKeyLastRequestTime: never;
  versionedExpirationTimer: never;
  primarySendsSms: never;
};

export type StorageInterface = {
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
};
