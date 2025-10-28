// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from '@signalapp/ringrtc';
import type {
  CustomColorsItemType,
  DefaultConversationColorType,
} from './Colors.std.js';
import type { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability.std.js';
import type { RetryItemType } from '../services/retryPlaceholders.std.js';
import type { ConfigMapType as RemoteConfigType } from '../RemoteConfig.dom.js';
import type { ExtendedStorageID, UnknownRecord } from './StorageService.d.ts';

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

// This should be in sync with `STORAGE_UI_KEYS` in `ts/types/StorageUIKeys.ts`.

export type StorageAccessType = {
  'always-relay-calls': boolean;
  'audio-notification': boolean;
  'auto-download-update': boolean;
  'auto-download-attachment': AutoDownloadAttachmentType;
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

  customColors: CustomColorsItemType;
  device_name: string;
  existingOnboardingStoryMessageIds: ReadonlyArray<string> | undefined;
  hasSetMyStoriesPrivacy: boolean;
  hasCompletedUsernameOnboarding: boolean;
  hasCompletedUsernameLinkOnboarding: boolean;
  hasCompletedSafetyNumberOnboarding: boolean;
  hasSeenGroupStoryEducationSheet: boolean;
  hasSeenNotificationProfileOnboarding: boolean;
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
  synced_at: number | undefined;
  userAgent: string;
  uuid_id: string;
  useRingrtcAdm: boolean;
  pni: string;
  version: string;
  linkPreviews: boolean;
  universalExpireTimer: number;
  retryPlaceholders: ReadonlyArray<RetryItemType>;
  donationWorkflow: string;
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
  'preferred-video-input-device': string | undefined;
  'preferred-audio-input-device': AudioDevice | undefined;
  'preferred-audio-output-device': AudioDevice | undefined;
  remoteConfig: RemoteConfigType;
  remoteConfigHash: string;
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
  attachmentDownloadManagerIdled: boolean;
  messageInsertTriggersDisabled: boolean;
  setBackupMessagesSignatureKey: boolean;
  setBackupMediaSignatureKey: boolean;
  lastReceivedAtCounter: number;
  preferredReactionEmoji: ReadonlyArray<string>;
  emojiSkinToneDefault: EmojiSkinToneDefault;
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
  // Note: for historical reasons, this has two l's
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
  serverAlerts: ServerAlertsType;
  needOrphanedAttachmentCheck: boolean;
  needProfileMovedModal: boolean;
  notificationProfileOverride: NotificationProfileOverride | undefined;
  notificationProfileOverrideFromPrimary:
    | NotificationProfileOverride
    | undefined;
  notificationProfileSyncDisabled: boolean;
  observedCapabilities: {
    attachmentBackfill?: true;

    // Note: Upon capability deprecation - change the value type to `never` and
    // remove it in `ts/background.ts`
    deleteSync?: never;
    ssre2?: never;
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

  backupTier: number | undefined;
  cloudBackupStatus: BackupStatusType | undefined;
  backupSubscriptionStatus: BackupsSubscriptionType | undefined;

  backupKeyViewed: boolean;
  localBackupFolder: string | undefined;

  // If true Desktop message history was restored from backup
  isRestoredFromBackup: boolean;

  // The `firstAppVersion` present on an BackupInfo from an imported backup.
  restoredBackupFirstAppVersion: string;

  // Stored solely for pesistance during import/export sequence
  svrPin: string;
  optimizeOnDeviceStorage: boolean;

  postRegistrationSyncsStatus: 'incomplete' | 'complete';

  avatarsHaveBeenMigrated: boolean;

  // Test-only
  // Not used UI, stored as is when imported from backup during tests
  defaultWallpaperPhotoPointer: Uint8Array;
  defaultWallpaperPreset: number;
  defaultDimWallpaperInDarkMode: boolean;
  defaultAutoBubbleColor: boolean;

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
  backupMediaDownloadIdle: never;
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
