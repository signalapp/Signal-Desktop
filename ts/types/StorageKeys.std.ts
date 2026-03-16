// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from '@signalapp/ringrtc';
import type {
  CustomColorsItemType,
  DefaultConversationColorType,
} from './Colors.std.js';
import type { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability.std.js';
import type { RetryItemType } from '../services/retryPlaceholders.std.js';
import type { ConfigMapType as RemoteConfigType } from '../RemoteConfig.dom.js';
import type { ExtendedStorageID, UnknownRecord } from './StorageService.js';

import type { GroupCredentialType } from '../textsecure/WebAPI.preload.js';
import type {
  SessionResetsType,
  StorageServiceCredentials,
} from '../textsecure/Types.js';
import type {
  BackupCredentialWrapperType,
  BackupsSubscriptionType,
  BackupStatusType,
} from './backups.node.js';
import type { ServiceIdString } from './ServiceId.std.js';
import type { RegisteredChallengeType } from '../challenge.dom.js';
import type { NotificationProfileOverride } from './NotificationProfile.std.js';
import type { PhoneNumberSharingMode } from './PhoneNumberSharingMode.std.js';
import type { LocalBackupExportMetadata } from './LocalExport.std.js';
import type { ServerAlertsType } from './ServerAlert.std.js';
import type { EmojiSkinTone } from './emoji.std.js';
import type { AssertSameMembers } from './Util.std.js';

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
  lastCallQualitySurveyTime: number;
  lastCallQualityFailureSurveyTime: number;
  cqsTestMode: boolean;
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
  deviceCreatedAt: number;
  existingOnboardingStoryMessageIds: ReadonlyArray<string> | undefined;
  hasSetMyStoriesPrivacy: boolean;
  hasCompletedUsernameOnboarding: boolean;
  hasCompletedUsernameLinkOnboarding: boolean;
  hasCompletedSafetyNumberOnboarding: boolean;
  hasSeenGroupStoryEducationSheet: boolean;
  hasSeenNotificationProfileOnboarding: boolean;
  hasSeenKeyTransparencyOnboarding: boolean;
  hasViewedOnboardingStory: boolean;
  hasStoriesDisabled: boolean;
  hasKeyTransparencyDisabled: boolean;
  storyViewReceiptsEnabled: boolean | undefined;
  identityKeyMap: IdentityKeyMap;
  lastAttemptedToRefreshProfilesAt: number;
  lastResortKeyUpdateTime: number;
  lastResortKeyUpdateTimePNI: number;
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
  seenPinMessageDisappearingMessagesWarningCount: number;
  hasSeenAdminDeleteEducationDialog: boolean;
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
  emojiSkinToneDefault: EmojiSkinTone;
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
  lastLocalBackup: LocalBackupExportMetadata;
  localBackupFolder: string | undefined;

  // If true Desktop message history was restored from backup
  isRestoredFromBackup: boolean;

  // The `firstAppVersion` present on an BackupInfo from an imported backup.
  restoredBackupFirstAppVersion: string;

  // Stored solely for pesistance during import/export sequence
  svrPin: string;
  optimizeOnDeviceStorage: boolean;
  pinReminders: boolean | undefined;
  screenLockTimeoutMinutes: number | undefined;
  'auto-download-attachment-primary':
    | undefined
    | {
        photos: number;
        audio: number;
        videos: number;
        documents: number;
      };
  androidSpecificSettings: unknown;
  callsUseLessDataSetting: unknown;
  allowSealedSenderFromAnyone: unknown;

  postRegistrationSyncsStatus: 'incomplete' | 'complete';

  avatarsHaveBeenMigrated: boolean;

  // Key Transparency
  lastDistinguishedTreeHead: Uint8Array;
  // Meaning of values:
  //
  // - undefined - status unknown or uninitialized
  // - 'ok' - last check passed
  // - 'intermittent' - last check failed, but we haven't retried yet
  // - 'fail' - last check failed after retry
  keyTransparencySelfHealth: undefined | 'ok' | 'intermittent' | 'fail';
  lastKeyTransparencySelfCheck: number;

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
  callQualitySurveyCooldownDisabled: never;
  localDeleteWarningShown: never;
};

export const STORAGE_KEYS_TO_PRESERVE_AFTER_UNLINK = [
  // UI & user-setting-related keys
  'always-relay-calls',
  'audio-notification',
  'audioMessage',
  'auto-download-update',
  'autoConvertEmoji',
  'badge-count-muted-conversations',
  'call-ringtone-notification',
  'call-system-notification',
  'customColors',
  'defaultConversationColor',
  'existingOnboardingStoryMessageIds',
  'hasCompletedSafetyNumberOnboarding',
  'hasCompletedUsernameLinkOnboarding',
  'hide-menu-bar',
  'incoming-call-notification',
  'navTabsCollapsed',
  'notification-draw-attention',
  'notification-setting',
  'pinnedConversationIds',
  'preferred-audio-input-device',
  'preferred-audio-output-device',
  'preferred-video-input-device',
  'preferredLeftPaneWidth',
  'preferredReactionEmoji',
  'sent-media-quality',
  'showStickerPickerHint',
  'showStickersIntroduction',
  'emojiSkinToneDefault',
  'textFormatting',
  'zoomFactor',

  // Bookkeeping keys
  'attachmentMigration_lastProcessedIndex',
  'attachmentMigration_isComplete',
  'chromiumRegistrationDoneEver',
  'version',
  'number_id',
  'uuid_id',
  'pni',
] as const satisfies ReadonlyArray<keyof StorageAccessType>;

const STORAGE_KEYS_TO_REMOVE_AFTER_UNLINK = [
  'auto-download-attachment',
  'blocked-groups',
  'blocked-uuids',
  'lastCallQualitySurveyTime',
  'lastCallQualityFailureSurveyTime',
  'cqsTestMode',
  'read-receipt-setting',
  'blocked',
  'device_name',
  'deviceCreatedAt',
  'hasSetMyStoriesPrivacy',
  'hasCompletedUsernameOnboarding',
  'hasSeenGroupStoryEducationSheet',
  'hasSeenNotificationProfileOnboarding',
  'hasSeenKeyTransparencyOnboarding',
  'hasViewedOnboardingStory',
  'hasStoriesDisabled',
  'hasKeyTransparencyDisabled',
  'storyViewReceiptsEnabled',
  'identityKeyMap',
  'lastAttemptedToRefreshProfilesAt',
  'lastResortKeyUpdateTime',
  'lastResortKeyUpdateTimePNI',
  'accountEntropyPool',
  'masterKey',
  'accountEntropyPoolLastRequestTime',
  'maxPreKeyId',
  'maxPreKeyIdPNI',
  'maxKyberPreKeyId',
  'maxKyberPreKeyIdPNI',
  'password',
  'profileKey',
  'regionCode',
  'registrationIdMap',
  'remoteBuildExpiration',
  'sessionResets',
  'seenPinMessageDisappearingMessagesWarningCount',
  'hasSeenAdminDeleteEducationDialog',
  'signedKeyId',
  'signedKeyIdPNI',
  'signedKeyUpdateTime',
  'signedKeyUpdateTimePNI',
  'storageKey',
  'synced_at',
  'userAgent',
  'useRingrtcAdm',
  'linkPreviews',
  'universalExpireTimer',
  'retryPlaceholders',
  'donationWorkflow',
  'chromiumRegistrationDone',
  'phoneNumberSharingMode',
  'phoneNumberDiscoverability',
  'preferContactAvatars',
  'typingIndicators',
  'sealedSenderIndicators',
  'storageFetchComplete',
  'avatarUrl',
  'manifestVersion',
  'manifestRecordIkm',
  'storageCredentials',
  'storage-service-error-records',
  'storage-service-unknown-records',
  'storage-service-pending-deletes',
  'remoteConfig',
  'remoteConfigHash',
  'serverTimeSkew',
  'unidentifiedDeliveryIndicators',
  'groupCredentials',
  'callLinkAuthCredentials',
  'backupCombinedCredentials',
  'backupCombinedCredentialsLastRequestTime',
  'backupMediaRootKey',
  'backupMediaDownloadTotalBytes',
  'backupMediaDownloadCompletedBytes',
  'backupMediaDownloadPaused',
  'backupMediaDownloadBannerDismissed',
  'attachmentDownloadManagerIdled',
  'messageInsertTriggersDisabled',
  'setBackupMessagesSignatureKey',
  'setBackupMediaSignatureKey',
  'lastReceivedAtCounter',
  'unreadCount',
  'challenge:conversations',
  'deviceNameEncrypted',
  'indexeddb-delete-needed',
  'senderCertificate',
  'senderCertificateNoE164',
  'paymentAddress',
  'nextScheduledUpdateKeyTime',
  'areWeASubscriber',
  'subscriberId',
  'subscriberCurrencyCode',
  'donorSubscriptionManuallyCancelled',
  'backupsSubscriberId',
  'backupsSubscriberPurchaseToken',
  'backupsSubscriberOriginalTransactionId',
  'displayBadgesOnProfile',
  'keepMutedChatsArchived',
  'usernameLastIntegrityCheck',
  'usernameCorrupted',
  'usernameLinkCorrupted',
  'usernameLinkColor',
  'usernameLink',
  'serverAlerts',
  'needOrphanedAttachmentCheck',
  'needProfileMovedModal',
  'notificationProfileOverride',
  'notificationProfileOverrideFromPrimary',
  'notificationProfileSyncDisabled',
  'observedCapabilities',
  'releaseNotesNextFetchTime',
  'releaseNotesVersionWatermark',
  'releaseNotesPreviousManifestHash',
  'backupDownloadPath',
  'backupEphemeralKey',
  'backupTransitArchive',
  'backupTier',
  'cloudBackupStatus',
  'backupSubscriptionStatus',
  'backupKeyViewed',
  'lastLocalBackup',
  'localBackupFolder',
  'isRestoredFromBackup',
  'restoredBackupFirstAppVersion',
  'svrPin',
  'optimizeOnDeviceStorage',
  'pinReminders',
  'screenLockTimeoutMinutes',
  'auto-download-attachment-primary',
  'androidSpecificSettings',
  'callsUseLessDataSetting',
  'allowSealedSenderFromAnyone',
  'postRegistrationSyncsStatus',
  'avatarsHaveBeenMigrated',
  'lastDistinguishedTreeHead',
  'keyTransparencySelfHealth',
  'lastKeyTransparencySelfCheck',
  'defaultWallpaperPhotoPointer',
  'defaultWallpaperPreset',
  'defaultDimWallpaperInDarkMode',
  'defaultAutoBubbleColor',
  'challenge:retry-message-ids',
  'nextSignedKeyRotationTime',
  'previousAudioDeviceModule',
  'senderCertificateWithUuid',
  'signaling_key',
  'signedKeyRotationRejected',
  'lastHeartbeat',
  'lastStartup',
  'sendEditWarningShown',
  'formattingWarningShown',
  'hasRegisterSupportForUnauthenticatedDelivery',
  'masterKeyLastRequestTime',
  'versionedExpirationTimer',
  'primarySendsSms',
  'backupMediaDownloadIdle',
  'callQualitySurveyCooldownDisabled',
  'localDeleteWarningShown',
] as const satisfies ReadonlyArray<keyof StorageAccessType>;

// Ensure every storage key is explicitly marked to be preserved or removed on unlink.

type AssertTrue<T extends true> = T;

type StorageKeysToPreserveAfterUnlink =
  (typeof STORAGE_KEYS_TO_PRESERVE_AFTER_UNLINK)[number];
type StorageKeysToRemoveAfterUnlink =
  (typeof STORAGE_KEYS_TO_REMOVE_AFTER_UNLINK)[number];

export type AssertStorageUnlinkKeysDoNotOverlap = AssertTrue<
  AssertSameMembers<
    Extract<StorageKeysToPreserveAfterUnlink, StorageKeysToRemoveAfterUnlink>,
    never
  >
>;

export type AssertStorageUnlinkKeysAreExhaustive = AssertTrue<
  AssertSameMembers<
    StorageKeysToPreserveAfterUnlink | StorageKeysToRemoveAfterUnlink,
    keyof StorageAccessType
  >
>;
