// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from '@signalapp/ringrtc';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  Fragment,
} from 'react';
import lodash from 'lodash';
import classNames from 'classnames';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import type { MutableRefObject, ReactNode, JSX } from 'react';
import type { RowType } from '@signalapp/sqlcipher';
import type { BackupLevel } from '@signalapp/libsignal-client/zkgroup.js';
import { ChatColorPicker } from './ChatColorPicker.dom.tsx';
import { WidthBreakpoint } from './_util.std.ts';
import { DisappearingTimeDialog } from './DisappearingTimeDialog.dom.tsx';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability.std.ts';
import { PhoneNumberSharingMode } from '../types/PhoneNumberSharingMode.std.ts';
import { KEY_TRANSPARENCY_URL } from '../types/support.std.ts';
import { getCustomColorStyle } from '../util/getCustomColorStyle.dom.ts';
import {
  DEFAULT_DURATIONS_IN_SECONDS,
  DEFAULT_DURATIONS_SET,
  format as formatExpirationTimer,
} from '../util/expirationTimer.std.ts';
import { DurationInSeconds } from '../util/durations/index.std.ts';
import { focusableSelector } from '../util/focusableSelectors.std.ts';
import { Modal } from './Modal.dom.tsx';
import { SearchInput } from './SearchInput.dom.tsx';
import { removeDiacritics } from '../util/removeDiacritics.std.ts';
import { assertDev } from '../util/assert.std.ts';
import { I18n } from './I18n.dom.tsx';
import { FunSkinTonesList } from './fun/FunSkinTones.dom.tsx';
import { SettingsRadio, SettingsRow } from './PreferencesUtil.dom.tsx';
import { PreferencesBackups } from './PreferencesBackups.dom.tsx';
import { PreferencesInternal } from './PreferencesInternal.dom.tsx';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { NavSidebar } from './NavSidebar.dom.tsx';
import type { SettingsLocation } from '../types/Nav.std.ts';
import { SettingsPage, ProfileEditorPage } from '../types/Nav.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import type { MediaDeviceSettings } from '../types/Calling.std.ts';
import type { ValidationResultType as BackupValidationResultType } from '../services/backups/index.preload.ts';
import type {
  AutoDownloadAttachmentType,
  NotificationSettingType,
  SentMediaQualitySettingType,
  ZoomFactorType,
  StorageAccessType,
} from '../types/StorageKeys.std.ts';
import type { ThemeSettingType } from '../util/theme.std.ts';
import type { AnyToast } from '../types/Toast.dom.tsx';
import { ToastType } from '../types/Toast.dom.tsx';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type {
  ConversationColorType,
  CustomColorType,
  DefaultConversationColorType,
} from '../types/Colors.std.ts';
import type {
  LocalizerType,
  SentMediaQualityType,
  ThemeType,
} from '../types/Util.std.ts';
import type {
  BackupMediaDownloadStatusType,
  BackupsSubscriptionType,
  BackupStatusType,
} from '../types/backups.node.ts';
import type { UnreadStats } from '../util/countUnreadStats.std.ts';
import type { BadgeType } from '../badges/types.std.ts';
import type { MessageCountBySchemaVersionType } from '../sql/Interface.std.ts';
import type { MessageAttributesType } from '../model-types.d.ts';
import { isBackupPage } from '../types/PreferencesBackupPage.std.ts';
import type { PreferencesBackupPage } from '../types/PreferencesBackupPage.std.ts';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain.main.ts';
import type { DonationReceipt } from '../types/Donations.std.ts';
import type { ChatFolderId } from '../types/ChatFolder.std.ts';
import type { SmartPreferencesEditChatFolderPageProps } from '../state/smart/PreferencesEditChatFolderPage.preload.tsx';
import type { SmartPreferencesChatFoldersPageProps } from '../state/smart/PreferencesChatFoldersPage.preload.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import type { ExternalProps as SmartNotificationProfilesProps } from '../state/smart/PreferencesNotificationProfiles.preload.tsx';
import type { LocalBackupExportMetadata } from '../types/LocalExport.std.ts';
import { isDonationsPage } from './PreferencesDonations.dom.tsx';
import type { VisibleRemoteMegaphoneType } from '../types/Megaphone.std.ts';
import { TitlebarDragArea } from './TitlebarDragArea.dom.tsx';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import { Emoji } from '../axo/emoji.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import moment from 'moment';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoList } from '../axo/items/AxoList.dom.tsx';
import { AxoSwitch } from '../axo/AxoSwitch.dom.tsx';
import { AxoSelect } from '../axo/AxoSelect.dom.tsx';
import type { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';

const { isNumber, noop, partition } = lodash;

type CheckboxChangeHandlerType = (value: boolean) => unknown;
type SelectChangeHandlerType<T = string | number> = (value: T) => unknown;

export type BlockedConversation = {
  conversation: ConversationType;
  blockedAt: number | undefined;
};

export type PropsDataType = {
  // Settings
  backupKey: string | undefined;
  backupKeyHash: string | undefined;
  autoDownloadAttachment: AutoDownloadAttachmentType;
  backupFreeMediaDays: number;
  previouslyViewedBackupKeyHash: string | undefined;
  backupLocalBackupsEnabled: boolean;
  backupTier: BackupLevel | null;
  lastLocalBackup: LocalBackupExportMetadata | undefined;
  localBackupFolder: string | undefined;
  currentChatFoldersCount: number;
  cloudBackupStatus?: BackupStatusType;
  backupSubscriptionStatus: BackupsSubscriptionType;
  backupMediaDownloadStatus?: BackupMediaDownloadStatusType;
  pauseBackupMediaDownload: VoidFunction;
  cancelBackupMediaDownload: VoidFunction;
  resumeBackupMediaDownload: VoidFunction;
  blockedContacts: ReadonlyArray<BlockedConversation>;
  blockedGroups: ReadonlyArray<BlockedConversation>;
  customColors: Record<string, CustomColorType>;
  defaultConversationColor: DefaultConversationColorType;
  deviceName?: string;
  emojiSkinToneDefault: Emoji.SkinTone;
  hasAnyCurrentCustomChatFolders: boolean;
  hasAudioNotifications?: boolean;
  hasAutoConvertEmoji: boolean;
  hasAutoDownloadUpdate: boolean;
  hasAutoLaunch: boolean | undefined;
  hasCallNotifications: boolean;
  hasCallRingtoneNotification: boolean;
  hasContentProtection: boolean | undefined;
  hasCountMutedConversations: boolean;
  hasHideMenuBar?: boolean;
  hasIncomingCallNotifications: boolean;
  hasKeyTransparencyDisabled: boolean;
  hasPinReminders: boolean | undefined;
  hasLinkPreviews: boolean;
  hasMediaCameraPermissions: boolean | undefined;
  hasMediaPermissions: boolean | undefined;
  hasMessageAudio: boolean;
  hasSealedSenderIndicators: boolean;
  hasMinimizeToAndStartInSystemTray: boolean | undefined;
  hasMinimizeToSystemTray: boolean | undefined;
  hasNotificationAttention: boolean;
  hasNotifications: boolean;
  hasPreferContactAvatars: boolean;
  hasReactionNotifications: boolean;
  hasReadReceipts: boolean;
  hasRelayCalls?: boolean;
  hasSpellCheck: boolean | undefined;
  hasStoriesDisabled: boolean;
  hasTextFormatting: boolean;
  hasTypingIndicators: boolean;
  hasKeepMutedChatsArchived: boolean;
  settingsLocation: SettingsLocation;
  lastSyncTime?: number;
  notificationContent: NotificationSettingType;
  osName: 'linux' | 'macos' | 'windows' | undefined;
  phoneNumber: string | undefined;
  selectedCamera?: string;
  selectedMicrophone?: AudioDevice;
  selectedSpeaker?: AudioDevice;
  sentMediaQualitySetting: SentMediaQualitySettingType;
  themeSetting: ThemeSettingType | undefined;
  universalExpireTimer: DurationInSeconds;
  whoCanFindMe: PhoneNumberDiscoverability;
  whoCanSeeMe: PhoneNumberSharingMode;
  zoomFactor: ZoomFactorType | undefined;

  // Localization
  availableLocales: ReadonlyArray<string>;
  localeOverride: string | null | undefined;
  preferredSystemLocales: ReadonlyArray<string>;
  resolvedLocale: string;

  // Other props
  badge: BadgeType | undefined;
  hasFailedStorySends: boolean;
  initialSpellCheckSetting: boolean;
  me: ConversationType;
  navTabsCollapsed: boolean;
  otherTabsUnreadStats: UnreadStats;
  preferredWidthFromStorage: number;
  shouldShowUpdateDialog: boolean;
  theme: ThemeType;
  weArePrimaryDevice: boolean;

  // Limited support features
  isAutoDownloadUpdatesSupported: boolean;
  isAutoLaunchSupported: boolean;
  isContentProtectionNeeded: boolean;
  isContentProtectionSupported: boolean;
  isHideMenuBarSupported: boolean;
  isKeyTransparencyAvailable: boolean;
  isNotificationAttentionSupported: boolean;
  isSyncSupported: boolean;
  isSystemTraySupported: boolean;
  isMinimizeToAndStartInSystemTraySupported: boolean;
  isInternalUser: boolean;

  // Devices
  availableCameras: Array<
    Pick<MediaDeviceInfo, 'deviceId' | 'groupId' | 'kind' | 'label'>
  >;

  donationReceipts: ReadonlyArray<DonationReceipt>;

  // calling internal preferences
  dredDuration: number | undefined;
  callStatsIntervalSecs: number | undefined;
  enableVp9Encode: boolean | undefined;
  enableVp9Decode: boolean | undefined;
  directMaxBitrate: number | undefined;
  groupMaxBitrate: number | undefined;
  isGroupSvcEnabled: boolean | undefined;
  groupSvcMode: string | undefined;
  groupSvcModeForScreenshare: string | undefined;
  sfuUrl: string | undefined;
} & Omit<MediaDeviceSettings, 'availableCameras'>;

type PropsFunctionType = {
  // Render props
  renderDonationsPane: (options: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    settingsLocation: SettingsLocation;
    setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  }) => JSX.Element;
  renderNotificationProfilesHome: (
    props: SmartNotificationProfilesProps
  ) => JSX.Element;
  renderNotificationProfilesCreateFlow: (
    props: SmartNotificationProfilesProps
  ) => JSX.Element;

  renderProfileEditor: (options: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
  }) => JSX.Element;
  renderToastManager: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderUpdateDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderPreferencesChatFoldersPage: (
    props: SmartPreferencesChatFoldersPageProps
  ) => JSX.Element;
  renderPreferencesEditChatFolderPage: (
    props: SmartPreferencesEditChatFolderPageProps
  ) => JSX.Element;

  // Other props
  addCustomColor: (color: CustomColorType) => unknown;
  disableLocalBackups: ({
    deleteExistingBackups,
  }: {
    deleteExistingBackups: boolean;
  }) => Promise<void>;
  doDeleteAllData: () => unknown;
  editCustomColor: (colorId: string, color: CustomColorType) => unknown;
  getMessageCountBySchemaVersion: () => Promise<MessageCountBySchemaVersionType>;
  getMessageSampleForSchemaVersion: (
    version: number
  ) => Promise<Array<MessageAttributesType>>;
  getPreferredBadge: PreferredBadgeSelectorType;
  resumeBackupMediaDownload: () => void;
  pauseBackupMediaDownload: () => void;
  getConversationsWithCustomColor: (colorId: string) => Array<ConversationType>;
  makeSyncRequest: () => unknown;
  onStartUpdate: () => unknown;
  pickLocalBackupFolder: () => Promise<string | undefined>;
  refreshCloudBackupStatus: () => void;
  refreshBackupSubscriptionStatus: () => void;
  removeCustomColor: (colorId: string) => unknown;
  removeCustomColorOnConversations: (colorId: string) => unknown;
  promptOSAuth: (
    reason: PromptOSAuthReasonType
  ) => Promise<PromptOSAuthResultType>;
  resetAllChatColors: () => unknown;
  resetDefaultChatColor: () => unknown;
  savePreferredLeftPaneWidth: (_: number) => void;
  setGlobalDefaultConversationColor: (
    color: ConversationColorType,
    customColorData?: {
      id: string;
      value: CustomColorType;
    }
  ) => unknown;
  setSettingsLocation: (settingsLocation: SettingsLocation) => unknown;
  showToast: (toast: AnyToast) => unknown;
  startLocalBackupExport: () => void;
  startPlaintextExport: () => unknown;
  validateBackup: () => Promise<BackupValidationResultType>;

  internalAddDonationReceipt: (receipt: DonationReceipt) => void;
  saveAttachmentToDisk: (options: {
    data: Uint8Array<ArrayBuffer>;
    name: string;
    baseDir?: string | undefined;
  }) => Promise<{ fullPath: string; name: string } | null>;
  generateDonationReceiptBlob: (
    receipt: DonationReceipt,
    i18n: LocalizerType
  ) => Promise<Blob>;
  addVisibleMegaphone: (megaphone: VisibleRemoteMegaphoneType) => void;

  // Change handlers
  onAudioNotificationsChange: CheckboxChangeHandlerType;
  onAutoConvertEmojiChange: CheckboxChangeHandlerType;
  onAutoDownloadAttachmentChange: (
    setting: AutoDownloadAttachmentType
  ) => unknown;
  onAutoDownloadUpdateChange: CheckboxChangeHandlerType;
  onAutoLaunchChange: CheckboxChangeHandlerType;
  onBackupKeyViewed: ({ backupKeyHash }: { backupKeyHash: string }) => void;
  onCallNotificationsChange: CheckboxChangeHandlerType;
  onCallRingtoneNotificationChange: CheckboxChangeHandlerType;
  onContentProtectionChange: CheckboxChangeHandlerType;
  onCountMutedConversationsChange: CheckboxChangeHandlerType;
  onEmojiSkinToneDefaultChange: (emojiSkinTone: Emoji.SkinTone) => void;
  onHasKeyTransparencyDisabledChanged: SelectChangeHandlerType<boolean>;
  onHasStoriesDisabledChanged: SelectChangeHandlerType<boolean>;
  onHideMenuBarChange: CheckboxChangeHandlerType;
  onIncomingCallNotificationsChange: CheckboxChangeHandlerType;
  onKeepMutedChatsArchivedChange: CheckboxChangeHandlerType;
  onLastSyncTimeChange: (time: number) => unknown;
  onLinkPreviewsChange: CheckboxChangeHandlerType;
  onLocaleChange: (locale: string | null | undefined) => void;
  onMediaCameraPermissionsChange: CheckboxChangeHandlerType;
  onMediaPermissionsChange: CheckboxChangeHandlerType;
  onMessageAudioChange: CheckboxChangeHandlerType;
  onMinimizeToAndStartInSystemTrayChange: CheckboxChangeHandlerType;
  onMinimizeToSystemTrayChange: CheckboxChangeHandlerType;
  onNotificationAttentionChange: CheckboxChangeHandlerType;
  onNotificationContentChange: SelectChangeHandlerType<NotificationSettingType>;
  onNotificationsChange: CheckboxChangeHandlerType;
  onPinRemindersChange: CheckboxChangeHandlerType;
  onPreferContactAvatarsChange: CheckboxChangeHandlerType;
  onReactionNotificationsChange: CheckboxChangeHandlerType;
  onReadReceiptsChange: CheckboxChangeHandlerType;
  onRelayCallsChange: CheckboxChangeHandlerType;
  onSealedSenderIndicatorsChange: CheckboxChangeHandlerType;
  onSelectedCameraChange: SelectChangeHandlerType<string | undefined>;
  onSelectedMicrophoneChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSelectedSpeakerChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSentMediaQualityChange: SelectChangeHandlerType<SentMediaQualityType>;
  onSpellCheckChange: CheckboxChangeHandlerType;
  onTextFormattingChange: CheckboxChangeHandlerType;
  onThemeChange: SelectChangeHandlerType<ThemeType>;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  onTypingIndicatorsChange: CheckboxChangeHandlerType;
  onUniversalExpireTimerChange: SelectChangeHandlerType<number>;
  onWhoCanFindMeChange: SelectChangeHandlerType<PhoneNumberDiscoverability>;
  onWhoCanSeeMeChange: SelectChangeHandlerType<PhoneNumberSharingMode>;
  onZoomFactorChange: SelectChangeHandlerType<ZoomFactorType>;
  openFileInFolder: (path: string) => void;
  internalDeleteAllMegaphones: () => Promise<number>;
  __dangerouslyRunAbitraryReadOnlySqlQuery: (
    readonlySqlQuery: string
  ) => Promise<ReadonlyArray<RowType<object>>>;
  cqsTestMode: boolean;
  setCqsTestMode: (value: boolean) => void;
  setDredDuration: (value: number | undefined) => void;
  setCallStatsIntervalSecs: (value: number | undefined) => void;
  setEnableVp9Encode: (value: boolean | undefined) => void;
  setEnableVp9Decode: (value: boolean | undefined) => void;
  setDirectMaxBitrate: (value: number | undefined) => void;
  setGroupMaxBitrate: (value: number | undefined) => void;
  setIsGroupSvcEnabled: (value: boolean | undefined) => void;
  setGroupSvcMode: (value: string | undefined) => void;
  setGroupSvcModeForScreenshare: (value: string | undefined) => void;
  setSfuUrl: (value: string | undefined) => void;
  forceKeyTransparencyCheck: () => Promise<void>;
  keyTransparencySelfHealth: StorageAccessType['keyTransparencySelfHealth'];

  // Localization
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsFunctionType;

export type PropsPreloadType = Omit<PropsType, 'i18n'>;

enum LanguageDialog {
  Selection,
  Confirmation,
}

const DEFAULT_ZOOM_FACTORS = [
  {
    text: '75%',
    value: 0.75,
  },
  {
    text: '90%',
    value: 0.9,
  },
  {
    text: '100%',
    value: 1,
  },
  {
    text: '110%',
    value: 1.1,
  },
  {
    text: '125%',
    value: 1.25,
  },
  {
    text: '150%',
    value: 1.5,
  },
  {
    text: '200%',
    value: 2,
  },
];

export function Preferences({
  addCustomColor,
  autoDownloadAttachment,
  availableCameras,
  availableLocales,
  availableMicrophones,
  availableSpeakers,
  backupMediaDownloadStatus,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  cancelBackupMediaDownload,
  backupFreeMediaDays,
  backupKey,
  backupKeyHash,
  backupTier,
  backupSubscriptionStatus,
  backupLocalBackupsEnabled,
  badge,
  blockedContacts,
  blockedGroups,
  currentChatFoldersCount,
  cloudBackupStatus,
  customColors,
  defaultConversationColor,
  deviceName = '',
  disableLocalBackups,
  doDeleteAllData,
  editCustomColor,
  emojiSkinToneDefault,
  getConversationsWithCustomColor,
  getMessageCountBySchemaVersion,
  getMessageSampleForSchemaVersion,
  getPreferredBadge,
  hasAnyCurrentCustomChatFolders,
  hasAudioNotifications,
  hasAutoConvertEmoji,
  hasAutoDownloadUpdate,
  hasAutoLaunch,
  hasCallNotifications,
  hasCallRingtoneNotification,
  hasContentProtection,
  hasCountMutedConversations,
  hasFailedStorySends,
  hasHideMenuBar,
  hasIncomingCallNotifications,
  hasKeyTransparencyDisabled,
  hasLinkPreviews,
  hasMediaCameraPermissions,
  hasMediaPermissions,
  hasMessageAudio,
  hasMinimizeToAndStartInSystemTray,
  hasMinimizeToSystemTray,
  hasNotificationAttention,
  hasNotifications,
  hasPinReminders,
  hasPreferContactAvatars,
  hasReactionNotifications,
  hasReadReceipts,
  hasRelayCalls,
  hasSealedSenderIndicators,
  hasSpellCheck,
  hasStoriesDisabled,
  hasTextFormatting,
  hasTypingIndicators,
  hasKeepMutedChatsArchived,
  i18n,
  initialSpellCheckSetting,
  isAutoDownloadUpdatesSupported,
  isAutoLaunchSupported,
  isContentProtectionNeeded,
  isContentProtectionSupported,
  isHideMenuBarSupported,
  isKeyTransparencyAvailable,
  isNotificationAttentionSupported,
  isSyncSupported,
  isSystemTraySupported,
  isMinimizeToAndStartInSystemTraySupported,
  isInternalUser,
  lastLocalBackup,
  lastSyncTime,
  localBackupFolder,
  makeSyncRequest,
  me,
  navTabsCollapsed,
  notificationContent,
  onAudioNotificationsChange,
  onAutoConvertEmojiChange,
  onAutoDownloadAttachmentChange,
  onAutoDownloadUpdateChange,
  onAutoLaunchChange,
  onBackupKeyViewed,
  onCallNotificationsChange,
  onCallRingtoneNotificationChange,
  onContentProtectionChange,
  onCountMutedConversationsChange,
  onEmojiSkinToneDefaultChange,
  onHasKeyTransparencyDisabledChanged,
  onHasStoriesDisabledChanged,
  onHideMenuBarChange,
  onIncomingCallNotificationsChange,
  onKeepMutedChatsArchivedChange,
  onLastSyncTimeChange,
  onLinkPreviewsChange,
  onLocaleChange,
  onMediaCameraPermissionsChange,
  onMediaPermissionsChange,
  onMessageAudioChange,
  onMinimizeToAndStartInSystemTrayChange,
  onMinimizeToSystemTrayChange,
  onNotificationAttentionChange,
  onNotificationContentChange,
  onNotificationsChange,
  onPinRemindersChange,
  onPreferContactAvatarsChange,
  onReactionNotificationsChange,
  onReadReceiptsChange,
  onRelayCallsChange,
  onSealedSenderIndicatorsChange,
  onSelectedCameraChange,
  onSelectedMicrophoneChange,
  onSelectedSpeakerChange,
  onSentMediaQualityChange,
  onSpellCheckChange,
  onTextFormattingChange,
  onThemeChange,
  onToggleNavTabsCollapse,
  onTypingIndicatorsChange,
  onUniversalExpireTimerChange,
  onWhoCanFindMeChange,
  onWhoCanSeeMeChange,
  onZoomFactorChange,
  otherTabsUnreadStats,
  settingsLocation,
  phoneNumber = '',
  pickLocalBackupFolder,
  preferredSystemLocales,
  preferredWidthFromStorage,
  refreshCloudBackupStatus,
  refreshBackupSubscriptionStatus,
  removeCustomColor,
  removeCustomColorOnConversations,
  renderDonationsPane,
  renderNotificationProfilesCreateFlow,
  renderNotificationProfilesHome,
  renderProfileEditor,
  renderToastManager,
  renderUpdateDialog,
  renderPreferencesChatFoldersPage,
  renderPreferencesEditChatFolderPage,
  openFileInFolder,
  osName,
  previouslyViewedBackupKeyHash,
  promptOSAuth,
  resetAllChatColors,
  resetDefaultChatColor,
  resolvedLocale,
  savePreferredLeftPaneWidth,
  selectedCamera,
  selectedMicrophone,
  selectedSpeaker,
  sentMediaQualitySetting,
  setGlobalDefaultConversationColor,
  setSettingsLocation,
  shouldShowUpdateDialog,
  showToast,
  startLocalBackupExport,
  startPlaintextExport,
  localeOverride,
  theme,
  themeSetting,
  universalExpireTimer,
  validateBackup,
  whoCanFindMe,
  whoCanSeeMe,
  zoomFactor,
  donationReceipts,
  internalAddDonationReceipt,
  saveAttachmentToDisk,
  generateDonationReceiptBlob,
  addVisibleMegaphone,
  internalDeleteAllMegaphones,
  __dangerouslyRunAbitraryReadOnlySqlQuery,
  cqsTestMode,
  setCqsTestMode,
  setDredDuration,
  dredDuration,
  callStatsIntervalSecs,
  setCallStatsIntervalSecs,
  setEnableVp9Encode,
  enableVp9Encode,
  setEnableVp9Decode,
  enableVp9Decode,
  setDirectMaxBitrate,
  directMaxBitrate,
  setGroupMaxBitrate,
  groupMaxBitrate,
  isGroupSvcEnabled,
  setIsGroupSvcEnabled,
  groupSvcMode,
  setGroupSvcMode,
  groupSvcModeForScreenshare,
  setGroupSvcModeForScreenshare,
  setSfuUrl,
  sfuUrl,
  forceKeyTransparencyCheck,
  keyTransparencySelfHealth,
  weArePrimaryDevice,
}: PropsType): JSX.Element {
  const languageId = useId();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStoriesOff, setConfirmStoriesOff] = useState(false);
  const [confirmContentProtection, setConfirmContentProtection] =
    useState(false);
  const [showSyncFailed, setShowSyncFailed] = useState(false);
  const [nowSyncing, setNowSyncing] = useState(false);
  const [showDisappearingTimerDialog, setShowDisappearingTimerDialog] =
    useState(false);
  const [languageDialog, setLanguageDialog] = useState<LanguageDialog | null>(
    null
  );
  const [selectedLanguageLocale, setSelectedLanguageLocale] = useState<
    string | null | undefined
  >(localeOverride);
  const [languageSearchInput, setLanguageSearchInput] = useState('');
  const [confirmPnpNotDiscoverable, setConfirmPnpNoDiscoverable] =
    useState(false);

  const handleOpenEditChatFoldersPage = useCallback(
    (chatFolderId: ChatFolderId | null) => {
      setSettingsLocation({
        page: SettingsPage.EditChatFolder,
        chatFolderId,
        initChatFolderParams: null,
        previousLocation: null,
      });
    },
    [setSettingsLocation]
  );

  function closeLanguageDialog() {
    setLanguageDialog(null);
    setSelectedLanguageLocale(localeOverride);
  }

  if (settingsLocation.page === SettingsPage.Internal && !isInternalUser) {
    setSettingsLocation({ page: SettingsPage.General });
  }

  let maybeUpdateDialog: JSX.Element | undefined;
  if (shouldShowUpdateDialog) {
    maybeUpdateDialog = renderUpdateDialog({
      containerWidthBreakpoint: WidthBreakpoint.Wide,
    });
  }

  const onZoomSelectChange = useCallback(
    (value: string) => {
      const number = parseFloat(value);
      onZoomFactorChange(number as unknown as ZoomFactorType);
    },
    [onZoomFactorChange]
  );

  const onAudioInputSelectChange = useCallback(
    (value: string) => {
      if (value === '') {
        onSelectedMicrophoneChange(undefined);
      } else {
        onSelectedMicrophoneChange(availableMicrophones[parseInt(value, 10)]);
      }
    },
    [onSelectedMicrophoneChange, availableMicrophones]
  );

  const handleContentProtectionChange = useCallback(
    (value: boolean) => {
      if (value || !isContentProtectionNeeded) {
        onContentProtectionChange(value);
      } else {
        setConfirmContentProtection(true);
      }
    },
    [onContentProtectionChange, isContentProtectionNeeded]
  );

  const settingsPaneRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const settingsPane = settingsPaneRef.current;
    if (!settingsPane) {
      return;
    }

    const elements = settingsPane.querySelectorAll<
      | HTMLAnchorElement
      | HTMLButtonElement
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >(focusableSelector);
    if (!elements.length) {
      return;
    }
    elements[0]?.focus();
  }, [settingsLocation.page]);

  const onAudioOutputSelectChange = useCallback(
    (value: string) => {
      if (value === '') {
        onSelectedSpeakerChange(undefined);
      } else {
        onSelectedSpeakerChange(availableSpeakers[parseInt(value, 10)]);
      }
    },
    [onSelectedSpeakerChange, availableSpeakers]
  );

  const localeDisplayNames = window.SignalContext.getLocaleDisplayNames();

  const getLocaleDisplayName = useCallback(
    (inLocale: string, ofLocale: string): string => {
      const displayName = localeDisplayNames[inLocale]?.[ofLocale];
      assertDev(
        displayName != null,
        `Locale display name in ${inLocale} of ${ofLocale} does not exist`
      );
      return (
        displayName ??
        new Intl.DisplayNames(inLocale, {
          type: 'language',
          languageDisplay: 'standard',
          style: 'long',
          fallback: 'code',
        }).of(ofLocale)
      );
    },
    [localeDisplayNames]
  );

  const localeSearchOptions = useMemo(() => {
    const collator = new Intl.Collator('en', { usage: 'sort' });

    const availableLocalesOptions = availableLocales
      .map(locale => {
        const currentLocaleLabel = getLocaleDisplayName(resolvedLocale, locale);
        const matchingLocaleLabel = getLocaleDisplayName(locale, locale);
        return { locale, currentLocaleLabel, matchingLocaleLabel };
      })
      .sort((a, b) => {
        return collator.compare(a.locale, b.locale);
      });

    const [localeOverrideMatches, localeOverrideNonMatches] = partition(
      availableLocalesOptions,
      option => {
        return option.locale === localeOverride;
      }
    );

    const preferredSystemLocaleMatch = LocaleMatcher.match(
      preferredSystemLocales as Array<string>, // bad types
      availableLocales as Array<string>, // bad types
      'en',
      { algorithm: 'best fit' }
    );

    return [
      ...localeOverrideMatches,
      {
        locale: null,
        currentLocaleLabel: i18n('icu:Preferences__Language__SystemLanguage'),
        matchingLocaleLabel: getLocaleDisplayName(
          preferredSystemLocaleMatch,
          preferredSystemLocaleMatch
        ),
      },
      ...localeOverrideNonMatches,
    ];
  }, [
    i18n,
    availableLocales,
    resolvedLocale,
    localeOverride,
    preferredSystemLocales,
    getLocaleDisplayName,
  ]);

  const localeSearchResults = useMemo(() => {
    return localeSearchOptions.filter(option => {
      const input = removeDiacritics(languageSearchInput.trim().toLowerCase());

      if (input === '') {
        return true;
      }

      function isMatch(value: string) {
        return removeDiacritics(value.toLowerCase()).includes(input);
      }

      return (
        isMatch(option.currentLocaleLabel) ||
        (option.matchingLocaleLabel && isMatch(option.matchingLocaleLabel))
      );
    });
  }, [localeSearchOptions, languageSearchInput]);

  let content: JSX.Element | undefined;

  if (settingsLocation.page === SettingsPage.Profile) {
    content = renderProfileEditor({
      contentsRef: settingsPaneRef,
    });
  } else if (settingsLocation.page === SettingsPage.General) {
    const pageContents = (
      <ListGroup>
        <List help={i18n('icu:Preferences--device-name__description')}>
          <ValueItem
            title={i18n('icu:Preferences--phone-number')}
            value={phoneNumber}
          />
          <ValueItem
            title={i18n('icu:Preferences--device-name')}
            value={deviceName}
          />
        </List>
        {weArePrimaryDevice && (
          <List title={i18n('icu:Preferences--signal-pin')}>
            <SwitchItem
              title={i18n('icu:Preferences--pin-reminders--header')}
              description={i18n('icu:Preferences--pin-reminders--description')}
              checked={hasPinReminders ?? false}
              onCheckedChange={onPinRemindersChange}
            />
          </List>
        )}
        <List title={i18n('icu:Preferences--system')}>
          {isAutoLaunchSupported && (
            <SwitchItem
              title={i18n('icu:autoLaunchDescription')}
              disabled={hasAutoLaunch === undefined}
              checked={hasAutoLaunch ?? false}
              onCheckedChange={onAutoLaunchChange}
            />
          )}
          {isHideMenuBarSupported && (
            <SwitchItem
              title={i18n('icu:hideMenuBar')}
              checked={hasHideMenuBar ?? false}
              onCheckedChange={onHideMenuBarChange}
            />
          )}
          {isSystemTraySupported && (
            <>
              <SwitchItem
                title={i18n('icu:SystemTraySetting__minimize-to-system-tray')}
                disabled={hasMinimizeToSystemTray === undefined}
                checked={hasMinimizeToSystemTray ?? false}
                onCheckedChange={onMinimizeToSystemTrayChange}
              />
              {isMinimizeToAndStartInSystemTraySupported && (
                <SwitchItem
                  title={i18n(
                    'icu:SystemTraySetting__minimize-to-and-start-in-system-tray'
                  )}
                  disabled={
                    !hasMinimizeToSystemTray ||
                    hasMinimizeToAndStartInSystemTray === undefined
                  }
                  checked={hasMinimizeToAndStartInSystemTray ?? false}
                  onCheckedChange={onMinimizeToAndStartInSystemTrayChange}
                />
              )}
            </>
          )}
        </List>
        <List title={i18n('icu:permissions')}>
          <SwitchItem
            title={i18n('icu:mediaPermissionsDescription')}
            disabled={hasMediaPermissions === undefined}
            checked={hasMediaPermissions ?? false}
            onCheckedChange={onMediaPermissionsChange}
          />
          <SwitchItem
            title={i18n('icu:mediaCameraPermissionsDescription')}
            disabled={hasMediaCameraPermissions === undefined}
            checked={hasMediaCameraPermissions ?? false}
            onCheckedChange={onMediaCameraPermissionsChange}
          />
        </List>
        {isAutoDownloadUpdatesSupported && (
          <List title={i18n('icu:Preferences--updates')}>
            <SwitchItem
              title={i18n('icu:Preferences__download-update')}
              checked={hasAutoDownloadUpdate}
              onCheckedChange={onAutoDownloadUpdateChange}
            />
          </List>
        )}

        <List>
          {!weArePrimaryDevice && (
            <ItemWithAction
              title={i18n('icu:clearDataHeader')}
              description={i18n('icu:clearDataExplanation')}
              action={
                <AxoItem.Action
                  variant="subtle-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  {i18n('icu:clearDataButton')}
                </AxoItem.Action>
              }
            />
          )}
          <AxoConfirmDialog.Root
            open={confirmDelete && !weArePrimaryDevice}
            onOpenChange={setConfirmDelete}
            title={i18n('icu:deleteAllDataHeader')}
            description={i18n('icu:deleteAllDataBody')}
          >
            <AxoConfirmDialog.Cancel />
            <AxoConfirmDialog.Action
              variant="strong-destructive"
              onClick={doDeleteAllData}
            >
              {i18n('icu:clearDataButton')}
            </AxoConfirmDialog.Action>
          </AxoConfirmDialog.Root>

          {weArePrimaryDevice && (
            <ItemWithAction
              title={i18n('icu:deleteAccountHeader')}
              description={i18n('icu:deleteAccountExplanation')}
              action={
                <AxoItem.Action
                  variant="subtle-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  {i18n('icu:deleteAccountButton')}
                </AxoItem.Action>
              }
            />
          )}
          <AxoConfirmDialog.Root
            open={confirmDelete && weArePrimaryDevice}
            onOpenChange={setConfirmDelete}
            title={i18n('icu:deleteAccountDialogHeader')}
            description={i18n('icu:deleteAccountDialogBody')}
          >
            <AxoConfirmDialog.Cancel />
            <AxoConfirmDialog.Action
              variant="strong-destructive"
              onClick={doDeleteAllData}
            >
              {i18n('icu:deleteAccountButton')}
            </AxoConfirmDialog.Action>
          </AxoConfirmDialog.Root>
        </List>
      </ListGroup>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--general')}
      />
    );
  } else if (isDonationsPage(settingsLocation.page)) {
    content = renderDonationsPane({
      contentsRef: settingsPaneRef,
      settingsLocation,
      setSettingsLocation,
    });
  } else if (settingsLocation.page === SettingsPage.Appearance) {
    let zoomFactors = DEFAULT_ZOOM_FACTORS;

    if (
      isNumber(zoomFactor) &&
      !zoomFactors.some(({ value }) => value === zoomFactor)
    ) {
      zoomFactors = [
        ...zoomFactors,
        {
          text: `${Math.round(zoomFactor * 100)}%`,
          value: zoomFactor,
        },
      ].sort((a, b) => a.value - b.value);
    }
    let localeText = '';
    if (localeOverride !== undefined) {
      localeText =
        localeOverride != null
          ? getLocaleDisplayName(resolvedLocale, localeOverride)
          : i18n('icu:Preferences__Language__SystemLanguage');
    }

    const pageContents = (
      <ListGroup>
        <List>
          <ClickableItem
            symbol="globe"
            title={i18n('icu:Preferences__Language__Label')}
            arrow
            value={
              <span
                className="Preferences__LanguageButton"
                lang={localeOverride ?? resolvedLocale}
              >
                {localeText}
              </span>
            }
            onClick={() => {
              // We haven't loaded the user's setting yet
              if (localeOverride === undefined) {
                return;
              }
              setLanguageDialog(LanguageDialog.Selection);
            }}
          />
          {languageDialog === LanguageDialog.Selection && (
            <Modal
              i18n={i18n}
              modalName="Preferences__LanguageModal"
              moduleClassName="Preferences__LanguageModal"
              padded={false}
              onClose={closeLanguageDialog}
              title={i18n('icu:Preferences__Language__ModalTitle')}
              modalHeaderChildren={
                <SearchInput
                  i18n={i18n}
                  value={languageSearchInput}
                  placeholder={i18n(
                    'icu:Preferences__Language__SearchLanguages'
                  )}
                  moduleClassName="Preferences__LanguageModal__SearchInput"
                  onChange={event => {
                    setLanguageSearchInput(event.currentTarget.value);
                  }}
                />
              }
              modalFooter={
                <>
                  <AxoButton.Root
                    variant="subtle-secondary"
                    size="lg"
                    onClick={closeLanguageDialog}
                  >
                    {i18n('icu:cancel')}
                  </AxoButton.Root>
                  <AxoButton.Root
                    variant="strong-primary"
                    size="lg"
                    disabled={selectedLanguageLocale === localeOverride}
                    onClick={() => {
                      setLanguageDialog(LanguageDialog.Confirmation);
                    }}
                  >
                    {i18n('icu:Preferences__LanguageModal__Set')}
                  </AxoButton.Root>
                </>
              }
            >
              {localeSearchResults.length === 0 && (
                <div className="Preferences__LanguageModal__NoResults">
                  {i18n('icu:Preferences__Language__NoResults', {
                    searchTerm: languageSearchInput.trim(),
                  })}
                </div>
              )}
              {localeSearchResults.map(option => {
                const id = `${languageId}:${option.locale ?? 'system'}`;
                const isSelected = option.locale === selectedLanguageLocale;
                return (
                  <button
                    key={id}
                    type="button"
                    className="Preferences__LanguageModal__Item"
                    onClick={() => {
                      setSelectedLanguageLocale(option.locale);
                    }}
                    aria-pressed={isSelected}
                  >
                    <span className="Preferences__LanguageModal__Item__Inner">
                      <span className="Preferences__LanguageModal__Item__Label">
                        <span className="Preferences__LanguageModal__Item__Current">
                          {option.currentLocaleLabel}
                        </span>
                        {option.matchingLocaleLabel != null && (
                          <span
                            lang={option.locale ?? resolvedLocale}
                            className="Preferences__LanguageModal__Item__Matching"
                          >
                            {option.matchingLocaleLabel}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="Preferences__LanguageModal__Item__Check" />
                      )}
                    </span>
                  </button>
                );
              })}
            </Modal>
          )}
          {languageDialog === LanguageDialog.Confirmation && (
            <AxoConfirmDialog.Root
              open
              onOpenChange={closeLanguageDialog}
              title={i18n('icu:Preferences__LanguageModal__Restart__Title')}
              description={i18n(
                'icu:Preferences__LanguageModal__Restart__Description'
              )}
            >
              <AxoConfirmDialog.Cancel>
                {i18n('icu:cancel')}
              </AxoConfirmDialog.Cancel>
              <AxoConfirmDialog.Action
                variant="strong-primary"
                onClick={() => onLocaleChange(selectedLanguageLocale)}
              >
                {i18n('icu:Preferences__LanguageModal__Restart__Button')}
              </AxoConfirmDialog.Action>
            </AxoConfirmDialog.Root>
          )}
          <SelectItem
            symbol="contrast"
            title={i18n('icu:Preferences--theme')}
            disabled={themeSetting === undefined}
            value={themeSetting ?? null}
            onValueChange={value => {
              onThemeChange(value as ThemeType);
            }}
            fallbackToFirstOption
            options={[
              {
                label: i18n('icu:themeSystem'),
                value: 'system',
              },
              {
                label: i18n('icu:themeLight'),
                value: 'light',
              },
              {
                label: i18n('icu:themeDark'),
                value: 'dark',
              },
            ]}
          />
          <ClickableItem
            symbol="palette"
            title={i18n('icu:showChatColorEditor')}
            arrow={false}
            onClick={() => {
              setSettingsLocation({ page: SettingsPage.ChatColor });
            }}
            accessory={
              <div
                className={`ConversationDetails__chat-color ConversationDetails__chat-color--${defaultConversationColor.color}`}
                style={{
                  ...getCustomColorStyle(
                    defaultConversationColor.customColorData?.value
                  ),
                }}
              />
            }
          />
          <SelectItem
            symbol="zoom-in"
            title={i18n('icu:Preferences--zoom')}
            disabled={zoomFactor === undefined}
            value={zoomFactor != null ? String(zoomFactor) : null}
            onValueChange={onZoomSelectChange}
            options={
              zoomFactors?.map(item => {
                return {
                  label: item.text,
                  value: String(item.value),
                };
              }) ?? []
            }
          />
        </List>
      </ListGroup>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--appearance')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.Chats) {
    let spellCheckDirtyText: string | undefined;
    if (
      hasSpellCheck !== undefined &&
      initialSpellCheckSetting !== hasSpellCheck
    ) {
      spellCheckDirtyText = hasSpellCheck
        ? i18n('icu:spellCheckWillBeEnabled')
        : i18n('icu:spellCheckWillBeDisabled');
    }

    const lastSyncDate = new Date(lastSyncTime || 0);

    const pageContents = (
      <ListGroup>
        <List accessibilityLabel={i18n('icu:Preferences__button--chats')}>
          <SwitchItem
            title={i18n('icu:Preferences__address-book-photos--title')}
            description={i18n(
              'icu:Preferences__address-book-photos--description'
            )}
            checked={hasPreferContactAvatars}
            onCheckedChange={onPreferContactAvatarsChange}
          />
          <SwitchItem
            title={i18n('icu:Preferences__keep-muted-chats-archived--title')}
            description={i18n(
              'icu:Preferences__keep-muted-chats-archived--description'
            )}
            checked={hasKeepMutedChatsArchived}
            onCheckedChange={onKeepMutedChatsArchivedChange}
          />
        </List>
        <List title={i18n('icu:Preferences__Chats__TextInputSection__Title')}>
          <SwitchItem
            title={i18n('icu:spellCheckDescription')}
            description={spellCheckDirtyText}
            disabled={hasSpellCheck === undefined}
            checked={hasSpellCheck ?? false}
            onCheckedChange={onSpellCheckChange}
          />
          <SwitchItem
            title={i18n('icu:textFormattingDescription')}
            checked={hasTextFormatting}
            onCheckedChange={onTextFormattingChange}
          />
          <SwitchItem
            title={i18n('icu:Preferences__link-previews--title')}
            description={i18n(
              'icu:Preferences__link-previews--new-description'
            )}
            checked={hasLinkPreviews}
            onCheckedChange={onLinkPreviewsChange}
          />
          <SwitchItem
            title={i18n('icu:Preferences__auto-convert-emoji--title')}
            description={
              <I18n
                i18n={i18n}
                id="icu:Preferences__auto-convert-emoji--description"
              />
            }
            checked={hasAutoConvertEmoji}
            onCheckedChange={onAutoConvertEmojiChange}
          />
          <AxoItem.Root>
            <AxoItem.Content>
              <AxoItem.Body>
                <AxoItem.Title>
                  {i18n('icu:Preferences__EmojiSkinToneDefaultSetting__Label')}
                </AxoItem.Title>
              </AxoItem.Body>
              <AxoItem.Accessory>
                <FunSkinTonesList
                  i18n={i18n}
                  emoji={Emoji.HAND}
                  skinTone={emojiSkinToneDefault}
                  onSelectSkinTone={onEmojiSkinToneDefaultChange}
                />
              </AxoItem.Accessory>
            </AxoItem.Content>
          </AxoItem.Root>
        </List>
        <List title={i18n('icu:Preferences__Chats__ChatFoldersSection__Title')}>
          <ClickableItem
            title={
              hasAnyCurrentCustomChatFolders
                ? i18n(
                    'icu:Preferences__ChatsPage__ChatFoldersSection__AddChatFolderItem__Title--WithChatFolders'
                  )
                : i18n(
                    'icu:Preferences__ChatsPage__ChatFoldersSection__AddChatFolderItem__Title'
                  )
            }
            description={i18n(
              'icu:Preferences__ChatsPage__ChatFoldersSection__AddChatFolderItem__Description'
            )}
            value={
              hasAnyCurrentCustomChatFolders
                ? i18n(
                    'icu:Preferences__ChatsPage__ChatFoldersSection__AddChatFolderItem__Description--WithChatFolders',
                    { chatFoldersCount: currentChatFoldersCount }
                  )
                : null
            }
            arrow
            onClick={() => {
              setSettingsLocation({
                page: SettingsPage.ChatFolders,
                previousLocation: null,
              });
            }}
          />
        </List>

        <List>
          <ItemWithAction
            title={i18n('icu:PlaintextExport--PreferencesRow--Header')}
            description={i18n(
              'icu:PlaintextExport--PreferencesRow--Description'
            )}
            action={
              <AxoItem.Action
                variant="subtle-secondary"
                onClick={startPlaintextExport}
              >
                {i18n('icu:PlaintextExport--ActionButton')}
              </AxoItem.Action>
            }
          />
        </List>

        {isSyncSupported && (
          <List>
            <ItemWithAction
              title={i18n('icu:sync')}
              description={
                <>
                  <div>
                    {i18n('icu:syncExplanation')}{' '}
                    {i18n('icu:Preferences--lastSynced', {
                      date: lastSyncDate.toLocaleDateString(),
                      time: lastSyncDate.toLocaleTimeString(),
                    })}
                  </div>
                  {showSyncFailed && (
                    <div className="Preferences__description Preferences__description--error">
                      {i18n('icu:syncFailed')}
                    </div>
                  )}
                </>
              }
              action={
                <AxoItem.Action
                  variant="subtle-secondary"
                  pending={nowSyncing}
                  onClick={async () => {
                    setShowSyncFailed(false);
                    setNowSyncing(true);
                    try {
                      await makeSyncRequest();
                      onLastSyncTimeChange(Date.now());
                    } catch (err) {
                      setShowSyncFailed(true);
                    } finally {
                      setNowSyncing(false);
                    }
                  }}
                >
                  {i18n('icu:syncNow')}
                </AxoItem.Action>
              }
            />
          </List>
        )}
      </ListGroup>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--chats')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.Calls) {
    const pageContents = (
      <ListGroup>
        <List accessibilityLabel={i18n('icu:calling')}>
          <SwitchItem
            title={i18n('icu:incomingCallNotificationDescription')}
            checked={hasIncomingCallNotifications}
            onCheckedChange={onIncomingCallNotificationsChange}
          />
          <SwitchItem
            title={i18n('icu:callRingtoneNotificationDescription')}
            checked={hasCallRingtoneNotification}
            onCheckedChange={onCallRingtoneNotificationChange}
          />
        </List>
        <List title={i18n('icu:Preferences__devices')}>
          <SelectItem
            title={i18n('icu:callingDeviceSelection__label--video')}
            disabled={!availableCameras.length}
            emptyOptionsLabel={i18n(
              'icu:callingDeviceSelection__select--no-device'
            )}
            value={selectedCamera ?? null}
            onValueChange={onSelectedCameraChange}
            fallbackToFirstOption
            options={availableCameras.map(device => {
              return {
                label: localizeDefault(i18n, device.label),
                value: device.deviceId,
              };
            })}
          />
          <SelectItem
            title={i18n('icu:callingDeviceSelection__label--audio-input')}
            disabled={!availableMicrophones.length}
            value={
              selectedMicrophone != null
                ? String(selectedMicrophone.index)
                : null
            }
            onValueChange={onAudioInputSelectChange}
            fallbackToFirstOption
            emptyOptionsLabel={i18n(
              'icu:callingDeviceSelection__select--no-device'
            )}
            options={availableMicrophones.map(device => {
              return {
                label: localizeDefault(i18n, device.name),
                value: String(device.index),
              };
            })}
          />

          <SelectItem
            title={i18n('icu:callingDeviceSelection__label--audio-output')}
            disabled={!availableSpeakers.length}
            value={
              selectedSpeaker != null ? String(selectedSpeaker.index) : null
            }
            onValueChange={onAudioOutputSelectChange}
            fallbackToFirstOption
            emptyOptionsLabel={i18n(
              'icu:callingDeviceSelection__select--no-device'
            )}
            options={availableSpeakers.map(device => {
              return {
                label: localizeDefault(i18n, device.name),
                value: String(device.index),
              };
            })}
          />
        </List>
        <List title={i18n('icu:Preferences--advanced')}>
          <SwitchItem
            description={i18n('icu:alwaysRelayCallsDetail')}
            title={i18n('icu:alwaysRelayCallsDescription')}
            checked={hasRelayCalls ?? false}
            onCheckedChange={onRelayCallsChange}
          />
        </List>
      </ListGroup>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--calls')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.Notifications) {
    const pageContents = (
      <ListGroup>
        <List>
          <SwitchItem
            title={i18n('icu:Preferences__enable-notifications')}
            checked={hasNotifications}
            onCheckedChange={onNotificationsChange}
          />
          <SwitchItem
            title={i18n('icu:callSystemNotificationDescription')}
            checked={hasCallNotifications}
            onCheckedChange={onCallNotificationsChange}
          />
          <SwitchItem
            title={i18n('icu:Preferences__reaction-notifications-title')}
            description={i18n(
              'icu:Preferences__reaction-notifications-description'
            )}
            checked={hasReactionNotifications}
            onCheckedChange={onReactionNotificationsChange}
          />
          {isNotificationAttentionSupported && (
            <SwitchItem
              title={i18n('icu:notificationDrawAttention')}
              checked={hasNotificationAttention}
              onCheckedChange={onNotificationAttentionChange}
            />
          )}
          <SelectItem
            title={i18n('icu:Preferences--notification-content')}
            disabled={!hasNotifications}
            value={notificationContent}
            onValueChange={onNotificationContentChange}
            options={[
              {
                label: i18n('icu:nameAndMessage'),
                value: 'message',
              },
              {
                label: i18n('icu:nameOnly'),
                value: 'name',
              },
              {
                label: i18n('icu:noNameOrMessage'),
                value: 'count',
              },
            ]}
          />
        </List>

        <List
          title={i18n('icu:Preferences__Notifications__SoundsSection__Title')}
        >
          <SwitchItem
            title={i18n('icu:audioNotificationDescription')}
            checked={hasAudioNotifications ?? false}
            onCheckedChange={onAudioNotificationsChange}
          />
          <SwitchItem
            title={i18n('icu:Preferences__message-audio-title')}
            description={i18n('icu:Preferences__message-audio-description')}
            checked={hasMessageAudio}
            onCheckedChange={onMessageAudioChange}
          />
        </List>

        <List
          title={i18n('icu:Preferences__Notifications__AppBadgeSection__Title')}
        >
          <SwitchItem
            title={i18n('icu:countMutedConversationsDescription')}
            checked={hasCountMutedConversations}
            onCheckedChange={onCountMutedConversationsChange}
          />
        </List>

        <List>
          <ClickableItem
            title={i18n('icu:NotificationProfiles--setting')}
            description={i18n('icu:NotificationProfiles--manage-description')}
            arrow
            onClick={() =>
              setSettingsLocation({
                page: SettingsPage.NotificationProfilesHome,
              })
            }
          />
        </List>
      </ListGroup>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--notifications')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.Privacy) {
    const isCustomDisappearingMessageValue =
      !DEFAULT_DURATIONS_SET.has(universalExpireTimer);
    let blockedDescription;

    if (
      (!blockedContacts.length && !blockedGroups.length) ||
      (blockedContacts.length && blockedGroups.length)
    ) {
      blockedDescription = i18n('icu:Preferences--blocked-count-both-new', {
        num: blockedContacts.length + blockedGroups.length,
      });
    } else if (blockedContacts.length) {
      blockedDescription = i18n('icu:Preferences--blocked-count-contacts-new', {
        num: blockedContacts.length,
      });
    } else {
      blockedDescription = i18n('icu:Preferences--blocked-count-groups-new', {
        num: blockedGroups.length,
      });
    }

    const pageContents = (
      <ListGroup>
        <List>
          <ClickableItem
            title={i18n('icu:Preferences__pnp__row--title')}
            description={i18n('icu:Preferences__pnp__row--body')}
            arrow
            onClick={() => setSettingsLocation({ page: SettingsPage.PNP })}
          />
        </List>
        <List>
          <ClickableItem
            title={i18n('icu:Preferences--blocked')}
            description={blockedDescription}
            arrow
            disabled={!blockedContacts.length && !blockedGroups.length}
            onClick={() => setSettingsLocation({ page: SettingsPage.Blocked })}
          />
        </List>
        <List
          title={i18n('icu:Preferences--messaging')}
          help={i18n('icu:Preferences--messaging-help')}
        >
          <SwitchItem
            title={i18n('icu:Preferences--read-receipts')}
            checked={hasReadReceipts}
            onCheckedChange={onReadReceiptsChange}
          />
          <SwitchItem
            title={i18n('icu:Preferences--typing-indicators')}
            checked={hasTypingIndicators}
            onCheckedChange={onTypingIndicatorsChange}
          />
        </List>
        {showDisappearingTimerDialog && (
          <DisappearingTimeDialog
            i18n={i18n}
            initialValue={universalExpireTimer}
            onClose={() => setShowDisappearingTimerDialog(false)}
            onSubmit={onUniversalExpireTimerChange}
          />
        )}
        <List title={i18n('icu:disappearingMessages')}>
          <SelectItem
            title={i18n('icu:settings__DisappearingMessages__timer__label')}
            description={i18n('icu:settings__DisappearingMessages__footer')}
            value={String(universalExpireTimer)}
            onValueChange={value => {
              if (value === String(universalExpireTimer) || value === '-1') {
                setShowDisappearingTimerDialog(true);
                return;
              }

              onUniversalExpireTimerChange(parseInt(value, 10));
            }}
            options={DEFAULT_DURATIONS_IN_SECONDS.map(seconds => {
              const label = formatExpirationTimer(i18n, seconds, {
                capitalizeOff: true,
              });
              return {
                value: String(seconds),
                label,
              };
            }).concat([
              {
                value: isCustomDisappearingMessageValue
                  ? String(universalExpireTimer)
                  : String(DurationInSeconds.fromSeconds(-1)),
                label: isCustomDisappearingMessageValue
                  ? formatExpirationTimer(i18n, universalExpireTimer)
                  : i18n('icu:selectedCustomDisappearingTimeOption'),
              },
            ])}
          />
        </List>
        {isContentProtectionSupported && (
          <List title={i18n('icu:Preferences__Privacy__Application')}>
            <SwitchItem
              description={i18n(
                'icu:Preferences__content-protection--description'
              )}
              title={i18n('icu:Preferences__content-protection--label')}
              disabled={hasContentProtection === undefined}
              checked={hasContentProtection ?? false}
              onCheckedChange={handleContentProtectionChange}
            />
          </List>
        )}
        {confirmContentProtection ? (
          <AxoConfirmDialog.Root
            open={confirmContentProtection}
            onOpenChange={setConfirmContentProtection}
            title={i18n('icu:Preferences__content-protection__modal--title')}
            description={i18n(
              'icu:Preferences__content-protection__modal--body'
            )}
          >
            <AxoConfirmDialog.Cancel />
            <AxoConfirmDialog.Action
              variant="strong-destructive"
              onClick={() => onContentProtectionChange(false)}
            >
              {i18n('icu:Preferences__content-protection__modal--disable')}
            </AxoConfirmDialog.Action>
          </AxoConfirmDialog.Root>
        ) : null}
        <List title={i18n('icu:Stories__title')}>
          <ItemWithAction
            title={i18n('icu:Stories__settings-toggle--title')}
            description={i18n('icu:Stories__settings-toggle--description')}
            action={
              hasStoriesDisabled ? (
                <AxoItem.Action
                  onClick={() => onHasStoriesDisabledChanged(false)}
                  variant="subtle-secondary"
                >
                  {i18n('icu:Preferences__turn-stories-on')}
                </AxoItem.Action>
              ) : (
                <AxoItem.Action
                  onClick={() => setConfirmStoriesOff(true)}
                  variant="subtle-destructive"
                >
                  {i18n('icu:Preferences__turn-stories-off')}
                </AxoItem.Action>
              )
            }
          />
        </List>
        <List title={i18n('icu:Preferences--advanced')}>
          <SwitchItem
            title={
              <>
                {i18n('icu:Preferences__PrivacyPage__ShowStatusIcon__Label')}
                <div className="Preferences__Privacy__StatusIcon" />
              </>
            }
            description={i18n(
              'icu:Preferences__PrivacyPage__ShowStatusIcon__Description'
            )}
            checked={hasSealedSenderIndicators}
            onCheckedChange={onSealedSenderIndicatorsChange}
          />
          {isKeyTransparencyAvailable && (
            <SwitchItem
              title={i18n(
                'icu:Preferences__PrivacyPage__KeyTransparency__Label'
              )}
              description={
                <>
                  {i18n(
                    'icu:Preferences__PrivacyPage__KeyTransparency__Description'
                  )}
                  &nbsp;
                  <a
                    href={KEY_TRANSPARENCY_URL}
                    rel="noreferrer"
                    target="_blank"
                    className={tw('text-primary')}
                  >
                    <I18n
                      i18n={i18n}
                      id="icu:Preferences__PrivacyPage__KeyTransparency__LearnMore"
                    />
                  </a>
                </>
              }
              checked={!hasKeyTransparencyDisabled}
              onCheckedChange={() => {
                onHasKeyTransparencyDisabledChanged(
                  !hasKeyTransparencyDisabled
                );
              }}
            />
          )}
        </List>
        <AxoConfirmDialog.Root
          open={confirmStoriesOff}
          onOpenChange={setConfirmStoriesOff}
          // @ts-expect-error ConfirmationDialog migration: Needs title
          title={null}
          description={i18n('icu:Preferences__turn-stories-off--body')}
        >
          <AxoConfirmDialog.Cancel />
          <AxoConfirmDialog.Action
            variant="strong-destructive"
            onClick={() => onHasStoriesDisabledChanged(true)}
          >
            {i18n('icu:Preferences__turn-stories-off--action')}
          </AxoConfirmDialog.Action>
        </AxoConfirmDialog.Root>
      </ListGroup>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--privacy')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.DataUsage) {
    const pageContents = (
      <ListGroup>
        <List
          title={i18n('icu:Preferences__media-auto-download')}
          help={i18n('icu:Preferences__media-auto-download__description')}
        >
          <SwitchItem
            title={i18n('icu:Preferences__media-auto-download__photos')}
            checked={autoDownloadAttachment.photos}
            onCheckedChange={(newValue: boolean) => {
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                photos: newValue,
              });
            }}
          />
          <SwitchItem
            title={i18n('icu:Preferences__media-auto-download__videos')}
            checked={autoDownloadAttachment.videos}
            onCheckedChange={(newValue: boolean) => {
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                videos: newValue,
              });
            }}
          />
          <SwitchItem
            title={i18n('icu:Preferences__media-auto-download__audio')}
            checked={autoDownloadAttachment.audio}
            onCheckedChange={(newValue: boolean) => {
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                audio: newValue,
              });
            }}
          />
          <SwitchItem
            title={i18n('icu:Preferences__media-auto-download__documents')}
            checked={autoDownloadAttachment.documents}
            onCheckedChange={(newValue: boolean) => {
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                documents: newValue,
              });
            }}
          />
        </List>
        <List>
          <SelectItem
            title={i18n('icu:Preferences__sent-media-quality')}
            description={i18n(
              'icu:Preferences__sent-media-quality__description'
            )}
            value={sentMediaQualitySetting}
            onValueChange={value => {
              onSentMediaQualityChange(value as SentMediaQualityType);
            }}
            options={[
              {
                label: i18n('icu:sentMediaQualityStandard'),
                value: 'standard',
              },
              {
                label: i18n('icu:sentMediaQualityHigh'),
                value: 'high',
              },
            ]}
          />
        </List>
      </ListGroup>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--data-usage')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.ChatColor) {
    const backButton = (
      <button
        aria-label={i18n('icu:goBack')}
        className="Preferences__back-icon"
        onClick={() => setSettingsLocation({ page: SettingsPage.Appearance })}
        type="button"
      />
    );
    const pageContents = (
      <ChatColorPicker
        customColors={customColors}
        getConversationsWithCustomColor={getConversationsWithCustomColor}
        i18n={i18n}
        isGlobal
        selectedColor={defaultConversationColor.color}
        selectedCustomColor={defaultConversationColor.customColorData || {}}
        // actions
        addCustomColor={addCustomColor}
        colorSelected={noop}
        editCustomColor={editCustomColor}
        removeCustomColor={removeCustomColor}
        removeCustomColorOnConversations={removeCustomColorOnConversations}
        resetAllChatColors={resetAllChatColors}
        resetDefaultChatColor={resetDefaultChatColor}
        setGlobalDefaultConversationColor={setGlobalDefaultConversationColor}
      />
    );
    content = (
      <PreferencesContent
        backButton={backButton}
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:ChatColorPicker__menu-title')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.ChatFolders) {
    content = renderPreferencesChatFoldersPage({
      previousLocation: settingsLocation.previousLocation,
      onOpenEditChatFoldersPage: handleOpenEditChatFoldersPage,
      settingsPaneRef,
    });
  } else if (settingsLocation.page === SettingsPage.EditChatFolder) {
    content = renderPreferencesEditChatFolderPage({
      previousLocation: settingsLocation.previousLocation,
      settingsPaneRef,
      existingChatFolderId: settingsLocation.chatFolderId,
      initChatFolderParams: settingsLocation.initChatFolderParams,
    });
  } else if (settingsLocation.page === SettingsPage.Blocked) {
    const backButton = (
      <button
        aria-label={i18n('icu:goBack')}
        className="Preferences__back-icon"
        onClick={() => setSettingsLocation({ page: SettingsPage.Privacy })}
        type="button"
      />
    );
    const pageContents = (
      <>
        <SettingsRow>
          <div className="Preferences__padding">
            <div className="Preferences__description">
              {i18n('icu:Preferences--blocked-users--description')}
            </div>
          </div>
        </SettingsRow>
        {blockedContacts.length > 0 ? (
          <SettingsRow title={i18n('icu:Preferences--blocked-users')}>
            {blockedContacts.map(({ conversation, blockedAt }) => {
              return (
                <div className={tw('flex w-full items-center px-[14px]')}>
                  <div className={tw('p-2')}>
                    <Avatar
                      conversationType={conversation.type}
                      badge={getPreferredBadge(conversation.badges)}
                      i18n={i18n}
                      size={AvatarSize.THIRTY_SIX}
                      theme={theme}
                      {...conversation}
                    />
                  </div>
                  <div className={tw('flex flex-col')}>
                    <div>{conversation.title}</div>
                    {isNumber(blockedAt) && blockedAt > 0 ? (
                      <div className={tw('type-body-small text-secondary')}>
                        {i18n('icu:Preferences--blocked--blocked-on', {
                          blockedAt: moment(blockedAt).format('ll'),
                        })}
                      </div>
                    ) : undefined}
                  </div>
                </div>
              );
            })}
          </SettingsRow>
        ) : undefined}
        {blockedGroups.length > 0 ? (
          <SettingsRow title={i18n('icu:Preferences--blocked-groups')}>
            {blockedGroups.map(({ conversation, blockedAt }) => {
              return (
                <div className={tw('flex w-full items-center px-[14px]')}>
                  <div className={tw('p-2')}>
                    <Avatar
                      conversationType={conversation.type}
                      badge={getPreferredBadge(conversation.badges)}
                      i18n={i18n}
                      size={AvatarSize.THIRTY_SIX}
                      theme={theme}
                      {...conversation}
                    />
                  </div>{' '}
                  <div className={tw('flex flex-col')}>
                    <div>{conversation.title}</div>
                    {isNumber(blockedAt) && blockedAt > 0 ? (
                      <div className={tw('type-body-small text-secondary')}>
                        {i18n('icu:Preferences--blocked--blocked-on', {
                          blockedAt: moment(blockedAt).format('ll'),
                        })}
                      </div>
                    ) : undefined}{' '}
                  </div>
                </div>
              );
            })}
          </SettingsRow>
        ) : undefined}
      </>
    );
    content = (
      <PreferencesContent
        backButton={backButton}
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences--blocked')}
      />
    );
  } else if (settingsLocation.page === SettingsPage.PNP) {
    let sharingDescription: string;

    if (whoCanSeeMe === PhoneNumberSharingMode.Everybody) {
      sharingDescription = i18n(
        'icu:Preferences__pnp__sharing--description--everyone'
      );
    } else if (whoCanFindMe === PhoneNumberDiscoverability.Discoverable) {
      sharingDescription = i18n(
        'icu:Preferences__pnp__sharing--description--nobody'
      );
    } else {
      sharingDescription = i18n(
        'icu:Preferences__pnp__sharing--description--nobody--not-discoverable'
      );
    }

    const backButton = (
      <button
        aria-label={i18n('icu:goBack')}
        className="Preferences__back-icon"
        onClick={() => setSettingsLocation({ page: SettingsPage.Privacy })}
        type="button"
      />
    );
    const pageContents = (
      <>
        <SettingsRow
          title={i18n('icu:Preferences__pnp__sharing--title')}
          className={classNames('Preferences__settings-row--pnp-sharing', {
            'Preferences__settings-row--pnp-sharing--nobody':
              whoCanSeeMe === PhoneNumberSharingMode.Nobody,
          })}
        >
          <SettingsRadio
            onChange={onWhoCanSeeMeChange}
            options={[
              {
                text: i18n('icu:Preferences__pnp__sharing__everyone'),
                value: PhoneNumberSharingMode.Everybody,
              },
              {
                text: i18n('icu:Preferences__pnp__sharing__nobody'),
                value: PhoneNumberSharingMode.Nobody,
              },
            ]}
            value={whoCanSeeMe}
          />
          <div className="Preferences__padding">
            <div className="Preferences__description">{sharingDescription}</div>
          </div>
        </SettingsRow>

        <SettingsRow
          title={i18n('icu:Preferences__pnp__discoverability--title')}
        >
          <SettingsRadio
            onChange={value => {
              if (value === PhoneNumberDiscoverability.NotDiscoverable) {
                setConfirmPnpNoDiscoverable(true);
              } else {
                onWhoCanFindMeChange(value);
              }
            }}
            options={[
              {
                text: i18n('icu:Preferences__pnp__discoverability__everyone'),
                value: PhoneNumberDiscoverability.Discoverable,
              },
              {
                text: i18n('icu:Preferences__pnp__discoverability__nobody'),
                value: PhoneNumberDiscoverability.NotDiscoverable,
                readOnly: whoCanSeeMe === PhoneNumberSharingMode.Everybody,
                onClick:
                  whoCanSeeMe === PhoneNumberSharingMode.Everybody
                    ? () =>
                        showToast({ toastType: ToastType.WhoCanFindMeReadOnly })
                    : noop,
              },
            ]}
            value={whoCanFindMe}
          />
          <div className="Preferences__padding">
            <div className="Preferences__description">
              {whoCanFindMe === PhoneNumberDiscoverability.Discoverable
                ? i18n(
                    'icu:Preferences__pnp__discoverability--description--everyone'
                  )
                : i18n(
                    'icu:Preferences__pnp__discoverability--description--nobody'
                  )}
            </div>
          </div>
        </SettingsRow>
        <AxoConfirmDialog.Root
          open={confirmPnpNotDiscoverable}
          onOpenChange={() => setConfirmPnpNoDiscoverable(false)}
          title={i18n(
            'icu:Preferences__pnp__discoverability__nobody__confirmModal__title'
          )}
          description={i18n(
            'icu:Preferences__pnp__discoverability__nobody__confirmModal__description',
            {
              // This is a rare instance where we want to interpolate the exact
              // text of the string into quotes in the translation as an
              // explanation.
              settingTitle: i18n(
                'icu:Preferences__pnp__discoverability--title'
              ),
              nobodyLabel: i18n(
                'icu:Preferences__pnp__discoverability__nobody'
              ),
            }
          )}
        >
          <AxoConfirmDialog.Cancel />
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() =>
              onWhoCanFindMeChange(PhoneNumberDiscoverability.NotDiscoverable)
            }
          >
            {i18n('icu:ok')}
          </AxoConfirmDialog.Action>
        </AxoConfirmDialog.Root>
      </>
    );
    content = (
      <PreferencesContent
        backButton={backButton}
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__pnp--page-title')}
      />
    );
  } else if (isBackupPage(settingsLocation.page)) {
    let pageTitle: string | undefined;
    if (
      settingsLocation.page === SettingsPage.Backups ||
      settingsLocation.page === SettingsPage.BackupsDetails
    ) {
      pageTitle = i18n('icu:Preferences__button--backups');
    } else if (settingsLocation.page === SettingsPage.LocalBackups) {
      pageTitle = i18n('icu:Preferences__local-backups');
    }
    // Local backups setup page titles intentionally left blank
    let backPage: PreferencesBackupPage | undefined;
    if (settingsLocation.page === SettingsPage.LocalBackupsKeyReference) {
      backPage = SettingsPage.LocalBackups;
    } else if (settingsLocation.page !== SettingsPage.Backups) {
      backPage = SettingsPage.Backups;
    }
    let backButton: JSX.Element | undefined;
    if (backPage) {
      backButton = (
        <button
          aria-label={i18n('icu:goBack')}
          className="Preferences__back-icon"
          onClick={() => setSettingsLocation({ page: backPage })}
          type="button"
        />
      );
    }
    const pageContents = (
      <PreferencesBackups
        backupKey={backupKey}
        backupKeyHash={backupKeyHash}
        backupFreeMediaDays={backupFreeMediaDays}
        backupTier={backupTier}
        backupSubscriptionStatus={backupSubscriptionStatus}
        backupMediaDownloadStatus={backupMediaDownloadStatus}
        cancelBackupMediaDownload={cancelBackupMediaDownload}
        pauseBackupMediaDownload={pauseBackupMediaDownload}
        resumeBackupMediaDownload={resumeBackupMediaDownload}
        cloudBackupStatus={cloudBackupStatus}
        i18n={i18n}
        isLocalBackupsEnabled={backupLocalBackupsEnabled}
        lastLocalBackup={lastLocalBackup}
        locale={resolvedLocale}
        localBackupFolder={localBackupFolder}
        onBackupKeyViewed={onBackupKeyViewed}
        openFileInFolder={openFileInFolder}
        osName={osName}
        pickLocalBackupFolder={pickLocalBackupFolder}
        previouslyViewedBackupKeyHash={previouslyViewedBackupKeyHash}
        disableLocalBackups={disableLocalBackups}
        settingsLocation={settingsLocation}
        promptOSAuth={promptOSAuth}
        refreshCloudBackupStatus={refreshCloudBackupStatus}
        refreshBackupSubscriptionStatus={refreshBackupSubscriptionStatus}
        setSettingsLocation={setSettingsLocation}
        showToast={showToast}
        startLocalBackupExport={startLocalBackupExport}
      />
    );
    content = (
      <PreferencesContent
        backButton={backButton}
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={pageTitle}
      />
    );
  } else if (settingsLocation.page === SettingsPage.NotificationProfilesHome) {
    content = renderNotificationProfilesHome({
      setSettingsLocation,
      contentsRef: settingsPaneRef,
    });
  } else if (
    settingsLocation.page === SettingsPage.NotificationProfilesCreateFlow
  ) {
    content = renderNotificationProfilesCreateFlow({
      setSettingsLocation,
      contentsRef: settingsPaneRef,
    });
  } else if (settingsLocation.page === SettingsPage.Internal) {
    content = (
      <PreferencesContent
        contents={
          <PreferencesInternal
            i18n={i18n}
            validateBackup={validateBackup}
            getMessageCountBySchemaVersion={getMessageCountBySchemaVersion}
            getMessageSampleForSchemaVersion={getMessageSampleForSchemaVersion}
            donationReceipts={donationReceipts}
            internalAddDonationReceipt={internalAddDonationReceipt}
            saveAttachmentToDisk={saveAttachmentToDisk}
            generateDonationReceiptBlob={generateDonationReceiptBlob}
            addVisibleMegaphone={addVisibleMegaphone}
            internalDeleteAllMegaphones={internalDeleteAllMegaphones}
            __dangerouslyRunAbitraryReadOnlySqlQuery={
              __dangerouslyRunAbitraryReadOnlySqlQuery
            }
            cqsTestMode={cqsTestMode}
            setCqsTestMode={setCqsTestMode}
            dredDuration={dredDuration}
            setDredDuration={setDredDuration}
            callStatsIntervalSecs={callStatsIntervalSecs}
            setCallStatsIntervalSecs={setCallStatsIntervalSecs}
            setEnableVp9Encode={setEnableVp9Encode}
            enableVp9Encode={enableVp9Encode}
            setEnableVp9Decode={setEnableVp9Decode}
            enableVp9Decode={enableVp9Decode}
            setDirectMaxBitrate={setDirectMaxBitrate}
            directMaxBitrate={directMaxBitrate}
            setGroupMaxBitrate={setGroupMaxBitrate}
            groupMaxBitrate={groupMaxBitrate}
            isGroupSvcEnabled={isGroupSvcEnabled}
            setIsGroupSvcEnabled={setIsGroupSvcEnabled}
            groupSvcMode={groupSvcMode}
            setGroupSvcMode={setGroupSvcMode}
            groupSvcModeForScreenshare={groupSvcModeForScreenshare}
            setGroupSvcModeForScreenshare={setGroupSvcModeForScreenshare}
            sfuUrl={sfuUrl}
            setSfuUrl={setSfuUrl}
            forceKeyTransparencyCheck={forceKeyTransparencyCheck}
            keyTransparencySelfHealth={keyTransparencySelfHealth}
          />
        }
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--internal')}
      />
    );
  }
  return (
    <>
      <div className="Preferences">
        <NavSidebar
          title={i18n('icu:Preferences--header')}
          i18n={i18n}
          otherTabsUnreadStats={otherTabsUnreadStats}
          hasFailedStorySends={hasFailedStorySends}
          hasPendingUpdate={false}
          navTabsCollapsed={navTabsCollapsed}
          onToggleNavTabsCollapse={onToggleNavTabsCollapse}
          preferredLeftPaneWidth={preferredWidthFromStorage}
          requiresFullWidth
          savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
          renderToastManager={renderToastManager}
        >
          <div className="Preferences__page-selector">
            {maybeUpdateDialog ? (
              <div className="Preferences__dialog-container">
                <div className="module-left-pane__dialogs">
                  {maybeUpdateDialog}
                </div>
              </div>
            ) : null}
            <div className="Preferences__scroll-area">
              <div
                className={classNames({
                  'Preferences__profile-chip': true,
                  'Preferences__profile-chip--selected':
                    settingsLocation.page === SettingsPage.Profile,
                })}
              >
                <div className="Preferences__profile-chip__avatar">
                  <Avatar
                    avatarUrl={me.avatarUrl}
                    badge={badge}
                    className="module-main-header__avatar"
                    color={me.color}
                    conversationType="direct"
                    i18n={i18n}
                    phoneNumber={me.phoneNumber}
                    profileName={me.profileName}
                    theme={theme}
                    title={me.title}
                    size={AvatarSize.FORTY_EIGHT}
                  />
                </div>
                <div className="Preferences__profile-chip__text-container">
                  <div className="Preferences__profile-chip__name">
                    {me.title}
                  </div>
                  <div className="Preferences__profile-chip__number">
                    {me.phoneNumber}
                  </div>
                  {me.username && (
                    <div className="Preferences__profile-chip__username">
                      {me.username}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="Preferences__profile-chip__button"
                  aria-label={i18n('icu:ProfileEditor__open')}
                  onClick={() => {
                    setSettingsLocation({
                      page: SettingsPage.Profile,
                      state: ProfileEditorPage.None,
                    });
                  }}
                >
                  <span className="Preferences__profile-chip__screenreader-only">
                    {i18n('icu:ProfileEditor__open')}
                  </span>
                </button>
                {me.username && (
                  <button
                    type="button"
                    className="Preferences__profile-chip__qr-icon-button"
                    aria-label={i18n('icu:ProfileEditor__username-link__open')}
                    onClick={() => {
                      setSettingsLocation({
                        page: SettingsPage.Profile,
                        state: ProfileEditorPage.UsernameLink,
                      });
                    }}
                  >
                    <div className="Preferences__profile-chip__qr-icon" />
                  </button>
                )}
              </div>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--general': true,
                  'Preferences__button--selected':
                    settingsLocation.page === SettingsPage.General,
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.General })
                }
              >
                {i18n('icu:Preferences__button--general')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--appearance': true,
                  'Preferences__button--selected':
                    settingsLocation.page === SettingsPage.Appearance ||
                    settingsLocation.page === SettingsPage.ChatColor,
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.Appearance })
                }
              >
                {i18n('icu:Preferences__button--appearance')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--chats': true,
                  'Preferences__button--selected':
                    settingsLocation.page === SettingsPage.Chats,
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.Chats })
                }
              >
                {i18n('icu:Preferences__button--chats')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--calls': true,
                  'Preferences__button--selected':
                    settingsLocation.page === SettingsPage.Calls,
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.Calls })
                }
              >
                {i18n('icu:Preferences__button--calls')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--notifications': true,
                  'Preferences__button--selected':
                    settingsLocation.page === SettingsPage.Notifications,
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.Notifications })
                }
              >
                {i18n('icu:Preferences__button--notifications')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--privacy': true,
                  'Preferences__button--selected':
                    settingsLocation.page === SettingsPage.Privacy ||
                    settingsLocation.page === SettingsPage.PNP ||
                    settingsLocation.page === SettingsPage.Blocked,
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.Privacy })
                }
              >
                {i18n('icu:Preferences__button--privacy')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--data-usage': true,
                  'Preferences__button--selected':
                    settingsLocation.page === SettingsPage.DataUsage,
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.DataUsage })
                }
              >
                {i18n('icu:Preferences__button--data-usage')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--backups': true,
                  'Preferences__button--selected': isBackupPage(
                    settingsLocation.page
                  ),
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.Backups })
                }
              >
                {i18n('icu:Preferences__button--backups')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--donations': true,
                  'Preferences__button--selected': isDonationsPage(
                    settingsLocation.page
                  ),
                })}
                onClick={() =>
                  setSettingsLocation({ page: SettingsPage.Donations })
                }
              >
                {i18n('icu:Preferences__button--donate')}
              </button>
              {isInternalUser ? (
                <button
                  type="button"
                  className={classNames({
                    Preferences__button: true,
                    'Preferences__button--internal': true,
                    'Preferences__button--selected':
                      settingsLocation.page === SettingsPage.Internal,
                  })}
                  onClick={() =>
                    setSettingsLocation({ page: SettingsPage.Internal })
                  }
                >
                  {i18n('icu:Preferences__button--internal')}
                </button>
              ) : null}
            </div>
          </div>
        </NavSidebar>
        <Fragment key={settingsLocation.page}>{content}</Fragment>
      </div>
      <TitlebarDragArea />
    </>
  );
}

function localizeDefault(i18n: LocalizerType, deviceLabel: string): string {
  return deviceLabel.toLowerCase().startsWith('default')
    ? deviceLabel.replace(
        /default/i,
        i18n('icu:callingDeviceSelection__select--default')
      )
    : deviceLabel;
}

export function PreferencesContent({
  backButton,
  contents,
  contentsRef,
  title,
  actions,
}: {
  backButton?: JSX.Element | undefined;
  contents: JSX.Element | undefined;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  title: string | undefined;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="Preferences__content">
      <div className="Preferences__title">
        {backButton}
        <div className="Preferences__title--header">{title}</div>
      </div>
      <div className="Preferences__page">
        <div className="Preferences__settings-pane-spacer" />
        <div className="Preferences__settings-pane" ref={contentsRef}>
          {contents}
        </div>
        <div className="Preferences__settings-pane-spacer" />
      </div>
      {actions && <div className="Preferences__actions">{actions}</div>}
    </div>
  );
}

type ListGroupProps = Readonly<{
  children: ReactNode;
}>;

function ListGroup(props: ListGroupProps): ReactNode {
  return (
    <div className={tw('flex max-w-[750px] flex-col gap-4 px-4 pt-2 pb-4')}>
      {props.children}
    </div>
  );
}

type ListProps = Readonly<{
  accessibilityLabel?: string;
  title?: string;
  help?: ReactNode;
  children: ReactNode;
}>;

function List(props: ListProps): ReactNode {
  return (
    <AxoList.Root accessibilityLabel={props.accessibilityLabel}>
      {props.title != null && (
        <AxoList.Header>
          <AxoList.Title>{props.title}</AxoList.Title>
        </AxoList.Header>
      )}
      <AxoList.Body>
        <AxoItem.Group>{props.children}</AxoItem.Group>
      </AxoList.Body>
      {props.help != null && (
        <AxoList.Footer>
          <AxoList.Help>{props.help}</AxoList.Help>
        </AxoList.Footer>
      )}
    </AxoList.Root>
  );
}

type SwitchItemProps = Readonly<{
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}>;

function SwitchItem(props: SwitchItemProps): ReactNode {
  return (
    <AxoItem.Root>
      <AxoItem.Content>
        <AxoItem.Body>
          <AxoItem.Title>{props.title}</AxoItem.Title>
          {props.description != null && (
            <AxoItem.Description>{props.description}</AxoItem.Description>
          )}
        </AxoItem.Body>
        <AxoItem.Accessory>
          <AxoSwitch.Root
            disabled={props.disabled}
            checked={props.checked}
            onCheckedChange={props.onCheckedChange}
          />
        </AxoItem.Accessory>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}

type SelectItemOption<T extends string> = Readonly<{
  value: T;
  label: string;
  disabled?: boolean;
}>;

type SelectItemProps<T extends string> = Readonly<{
  symbol?: AxoSymbol.Name;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
  value: T | null;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SelectItemOption<T>>;
  fallbackToFirstOption?: boolean;
  emptyOptionsLabel?: string;
}>;

function SelectItem<T extends string>(props: SelectItemProps<T>): ReactNode {
  const {
    onValueChange,
    options,
    placeholder,
    fallbackToFirstOption,
    emptyOptionsLabel,
  } = props;

  const handleValueChange = useCallback(
    (value: string) => {
      onValueChange(value as T);
    },
    [onValueChange]
  );

  const renderPlaceholder = useMemo(() => {
    if (options.length === 0 && emptyOptionsLabel != null) {
      return emptyOptionsLabel;
    }

    if (placeholder != null) {
      return placeholder;
    }

    if (fallbackToFirstOption) {
      return options.at(0)?.label ?? '';
    }

    return '';
  }, [placeholder, options, emptyOptionsLabel, fallbackToFirstOption]);

  return (
    <AxoItem.Root>
      {props.symbol != null && <AxoItem.Icon symbol={props.symbol} />}
      <AxoItem.Content>
        <AxoItem.Body>
          <AxoItem.Title>{props.title}</AxoItem.Title>
          {props.description != null && (
            <AxoItem.Description>{props.description}</AxoItem.Description>
          )}
        </AxoItem.Body>
        <AxoItem.Accessory>
          <AxoSelect.Root
            disabled={props.disabled}
            value={props.value}
            onValueChange={handleValueChange}
          >
            <AxoSelect.Trigger placeholder={renderPlaceholder} />
            <AxoSelect.Content>
              {options.map(item => {
                return (
                  <AxoSelect.Item
                    key={item.value}
                    value={item.value}
                    disabled={item.disabled}
                  >
                    <AxoSelect.ItemText>{item.label}</AxoSelect.ItemText>
                  </AxoSelect.Item>
                );
              })}
            </AxoSelect.Content>
          </AxoSelect.Root>
        </AxoItem.Accessory>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}

type ValueItemProps = Readonly<{
  title: ReactNode;
  value: ReactNode;
}>;

function ValueItem(props: ValueItemProps): ReactNode {
  const id = useId();
  return (
    <AxoItem.Root>
      <AxoItem.Content>
        <AxoItem.Body>
          <AxoItem.Title id={id}>{props.title}</AxoItem.Title>
          <AxoItem.Value>{props.value}</AxoItem.Value>
        </AxoItem.Body>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}

type ClickableItemProps = Readonly<{
  symbol?: AxoSymbol.Name;
  title: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  accessory?: ReactNode;
  arrow: boolean;
  disabled?: boolean;
  onClick: () => void;
}>;

function ClickableItem(props: ClickableItemProps): ReactNode {
  const id = useId();
  return (
    <AxoItem.Root>
      {props.symbol != null && <AxoItem.Icon symbol={props.symbol} />}
      <AxoItem.Content>
        <AxoItem.Body>
          <AxoItem.Title id={id}>{props.title}</AxoItem.Title>
          {props.value != null && <AxoItem.Value>{props.value}</AxoItem.Value>}
          {props.description != null && (
            <AxoItem.Description>{props.description}</AxoItem.Description>
          )}
          {!props.disabled && (
            <AxoItem.HiddenTrigger labelledby={id} onClick={props.onClick} />
          )}
        </AxoItem.Body>
        {props.accessory != null && (
          <AxoItem.Accessory>{props.accessory}</AxoItem.Accessory>
        )}
      </AxoItem.Content>
      {props.arrow && !props.disabled && <AxoItem.Arrow />}
    </AxoItem.Root>
  );
}

type ItemWithActionProps = Readonly<{
  title: ReactNode;
  description?: ReactNode;
  action: ReactNode;
}>;

function ItemWithAction(props: ItemWithActionProps): ReactNode {
  const id = useId();
  return (
    <AxoItem.Root>
      <AxoItem.Content>
        <AxoItem.Body>
          <AxoItem.Title id={id}>{props.title}</AxoItem.Title>
          {props.description != null && (
            <AxoItem.Description>{props.description}</AxoItem.Description>
          )}
        </AxoItem.Body>
        <AxoItem.Accessory>{props.action}</AxoItem.Accessory>
      </AxoItem.Content>
    </AxoItem.Root>
  );
}
