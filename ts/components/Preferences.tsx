// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from '@signalapp/ringrtc';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from 'react';
import { isNumber, noop, partition } from 'lodash';
import classNames from 'classnames';
import * as LocaleMatcher from '@formatjs/intl-localematcher';
import type { MutableRefObject, ReactNode } from 'react';
import type { RowType } from '@signalapp/sqlcipher';
import { Button, ButtonVariant } from './Button';
import { ChatColorPicker } from './ChatColorPicker';
import { Checkbox } from './Checkbox';
import { WidthBreakpoint } from './_util';
import { ConfirmationDialog } from './ConfirmationDialog';
import { DisappearingTimeDialog } from './DisappearingTimeDialog';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import { Select } from './Select';
import { Spinner } from './Spinner';
import { getCustomColorStyle } from '../util/getCustomColorStyle';
import {
  DEFAULT_DURATIONS_IN_SECONDS,
  DEFAULT_DURATIONS_SET,
  format as formatExpirationTimer,
} from '../util/expirationTimer';
import { DurationInSeconds } from '../util/durations';
import { focusableSelector } from '../util/focusableSelectors';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';
import { removeDiacritics } from '../util/removeDiacritics';
import { assertDev } from '../util/assert';
import { I18n } from './I18n';
import { FunSkinTonesList } from './fun/FunSkinTones';
import { emojiParentKeyConstant, type EmojiSkinTone } from './fun/data/emojis';
import {
  SettingsControl as Control,
  FlowingSettingsControl as FlowingControl,
  SettingsRadio,
  SettingsRow,
} from './PreferencesUtil';
import { PreferencesBackups } from './PreferencesBackups';
import { PreferencesInternal } from './PreferencesInternal';
import { FunEmojiLocalizationProvider } from './fun/FunEmojiLocalizationProvider';
import { Avatar, AvatarSize } from './Avatar';
import { NavSidebar } from './NavSidebar';
import { SettingsPage, ProfileEditorPage } from '../types/Nav';

import type { MediaDeviceSettings } from '../types/Calling';
import type { ValidationResultType as BackupValidationResultType } from '../services/backups';
import type {
  AutoDownloadAttachmentType,
  NotificationSettingType,
  SentMediaQualitySettingType,
  ZoomFactorType,
} from '../types/Storage.d';
import type { ThemeSettingType } from '../types/StorageUIKeys';
import type { AnyToast } from '../types/Toast';
import { ToastType } from '../types/Toast';
import type { ConversationType } from '../state/ducks/conversations';
import type {
  ConversationColorType,
  CustomColorType,
  DefaultConversationColorType,
} from '../types/Colors';
import type {
  LocalizerType,
  SentMediaQualityType,
  ThemeType,
} from '../types/Util';
import type {
  BackupMediaDownloadStatusType,
  BackupsSubscriptionType,
  BackupStatusType,
} from '../types/backups';
import type { UnreadStats } from '../util/countUnreadStats';
import type { BadgeType } from '../badges/types';
import type { MessageCountBySchemaVersionType } from '../sql/Interface';
import type { MessageAttributesType } from '../model-types';
import { isBackupPage } from '../types/PreferencesBackupPage';
import type { PreferencesBackupPage } from '../types/PreferencesBackupPage';
import type {
  PromptOSAuthReasonType,
  PromptOSAuthResultType,
} from '../util/os/promptOSAuthMain';
import type { DonationReceipt } from '../types/Donations';
import type { ChatFolderId } from '../types/ChatFolder';
import { isChatFoldersEnabled } from '../types/ChatFolder';
import type { SmartPreferencesEditChatFolderPageProps } from '../state/smart/PreferencesEditChatFolderPage';
import type { SmartPreferencesChatFoldersPageProps } from '../state/smart/PreferencesChatFoldersPage';

type CheckboxChangeHandlerType = (value: boolean) => unknown;
type SelectChangeHandlerType<T = string | number> = (value: T) => unknown;

export type PropsDataType = {
  // Settings
  accountEntropyPool: string | undefined;
  autoDownloadAttachment: AutoDownloadAttachmentType;
  backupFeatureEnabled: boolean;
  backupKeyViewed: boolean;
  backupLocalBackupsEnabled: boolean;
  localBackupFolder: string | undefined;
  cloudBackupStatus?: BackupStatusType;
  backupSubscriptionStatus: BackupsSubscriptionType;
  backupMediaDownloadStatus?: BackupMediaDownloadStatusType;
  pauseBackupMediaDownload: VoidFunction;
  cancelBackupMediaDownload: VoidFunction;
  resumeBackupMediaDownload: VoidFunction;
  blockedCount: number;
  customColors: Record<string, CustomColorType>;
  defaultConversationColor: DefaultConversationColorType;
  deviceName?: string;
  donationsFeatureEnabled: boolean;
  emojiSkinToneDefault: EmojiSkinTone;
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
  hasLinkPreviews: boolean;
  hasMediaCameraPermissions: boolean | undefined;
  hasMediaPermissions: boolean | undefined;
  hasMessageAudio: boolean;
  hasMinimizeToAndStartInSystemTray: boolean | undefined;
  hasMinimizeToSystemTray: boolean | undefined;
  hasNotificationAttention: boolean;
  hasNotifications: boolean;
  hasReadReceipts: boolean;
  hasRelayCalls?: boolean;
  hasSpellCheck: boolean | undefined;
  hasStoriesDisabled: boolean;
  hasTextFormatting: boolean;
  hasTypingIndicators: boolean;
  hasKeepMutedChatsArchived: boolean;
  page: SettingsPage;
  lastSyncTime?: number;
  notificationContent: NotificationSettingType;
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

  // Limited support features
  isAutoDownloadUpdatesSupported: boolean;
  isAutoLaunchSupported: boolean;
  isContentProtectionNeeded: boolean;
  isContentProtectionSupported: boolean;
  isHideMenuBarSupported: boolean;
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
} & Omit<MediaDeviceSettings, 'availableCameras'>;

type PropsFunctionType = {
  // Render props
  renderDonationsPane: (options: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    page: SettingsPage;
    setPage: (page: SettingsPage, profilePage?: ProfileEditorPage) => void;
  }) => JSX.Element;
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
  doDeleteAllData: () => unknown;
  editCustomColor: (colorId: string, color: CustomColorType) => unknown;
  exportLocalBackup: () => Promise<BackupValidationResultType>;
  getMessageCountBySchemaVersion: () => Promise<MessageCountBySchemaVersionType>;
  getMessageSampleForSchemaVersion: (
    version: number
  ) => Promise<Array<MessageAttributesType>>;
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
  setPage: (page: SettingsPage, editState?: ProfileEditorPage) => unknown;
  showToast: (toast: AnyToast) => unknown;
  validateBackup: () => Promise<BackupValidationResultType>;

  internalAddDonationReceipt: (receipt: DonationReceipt) => void;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
    baseDir?: string | undefined;
  }) => Promise<{ fullPath: string; name: string } | null>;
  generateDonationReceiptBlob: (
    receipt: DonationReceipt,
    i18n: LocalizerType
  ) => Promise<Blob>;

  // Change handlers
  onAudioNotificationsChange: CheckboxChangeHandlerType;
  onAutoConvertEmojiChange: CheckboxChangeHandlerType;
  onAutoDownloadAttachmentChange: (
    setting: AutoDownloadAttachmentType
  ) => unknown;
  onAutoDownloadUpdateChange: CheckboxChangeHandlerType;
  onAutoLaunchChange: CheckboxChangeHandlerType;
  onBackupKeyViewedChange: (keyViewed: boolean) => void;
  onCallNotificationsChange: CheckboxChangeHandlerType;
  onCallRingtoneNotificationChange: CheckboxChangeHandlerType;
  onContentProtectionChange: CheckboxChangeHandlerType;
  onCountMutedConversationsChange: CheckboxChangeHandlerType;
  onEmojiSkinToneDefaultChange: (emojiSkinTone: EmojiSkinTone) => void;
  onHasStoriesDisabledChanged: SelectChangeHandlerType<boolean>;
  onHideMenuBarChange: CheckboxChangeHandlerType;
  onIncomingCallNotificationsChange: CheckboxChangeHandlerType;
  onKeepMutedChatsArchivedChange: CheckboxChangeHandlerType;
  onLastSyncTimeChange: (time: number) => unknown;
  onLocaleChange: (locale: string | null | undefined) => void;
  onMediaCameraPermissionsChange: CheckboxChangeHandlerType;
  onMediaPermissionsChange: CheckboxChangeHandlerType;
  onMessageAudioChange: CheckboxChangeHandlerType;
  onMinimizeToAndStartInSystemTrayChange: CheckboxChangeHandlerType;
  onMinimizeToSystemTrayChange: CheckboxChangeHandlerType;
  onNotificationAttentionChange: CheckboxChangeHandlerType;
  onNotificationContentChange: SelectChangeHandlerType<NotificationSettingType>;
  onNotificationsChange: CheckboxChangeHandlerType;
  onRelayCallsChange: CheckboxChangeHandlerType;
  onSelectedCameraChange: SelectChangeHandlerType<string | undefined>;
  onSelectedMicrophoneChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSelectedSpeakerChange: SelectChangeHandlerType<AudioDevice | undefined>;
  onSentMediaQualityChange: SelectChangeHandlerType<SentMediaQualityType>;
  onSpellCheckChange: CheckboxChangeHandlerType;
  onTextFormattingChange: CheckboxChangeHandlerType;
  onThemeChange: SelectChangeHandlerType<ThemeType>;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  onUniversalExpireTimerChange: SelectChangeHandlerType<number>;
  onWhoCanSeeMeChange: SelectChangeHandlerType<PhoneNumberSharingMode>;
  onWhoCanFindMeChange: SelectChangeHandlerType<PhoneNumberDiscoverability>;
  onZoomFactorChange: SelectChangeHandlerType<ZoomFactorType>;
  __dangerouslyRunAbitraryReadOnlySqlQuery: (
    readonlySqlQuery: string
  ) => Promise<ReadonlyArray<RowType<object>>>;

  // Localization
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsFunctionType;

export type PropsPreloadType = Omit<PropsType, 'i18n'>;

function isDonationsPage(page: SettingsPage): boolean {
  return (
    page === SettingsPage.Donations ||
    page === SettingsPage.DonationsDonateFlow ||
    page === SettingsPage.DonationsReceiptList
  );
}

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
    text: '100%',
    value: 1,
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
  accountEntropyPool,
  addCustomColor,
  autoDownloadAttachment,
  availableCameras,
  availableLocales,
  availableMicrophones,
  availableSpeakers,
  backupFeatureEnabled,
  backupMediaDownloadStatus,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  cancelBackupMediaDownload,
  backupKeyViewed,
  backupSubscriptionStatus,
  backupLocalBackupsEnabled,
  badge,
  blockedCount,
  cloudBackupStatus,
  customColors,
  defaultConversationColor,
  deviceName = '',
  doDeleteAllData,
  donationsFeatureEnabled,
  editCustomColor,
  emojiSkinToneDefault,
  exportLocalBackup,
  getConversationsWithCustomColor,
  getMessageCountBySchemaVersion,
  getMessageSampleForSchemaVersion,
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
  hasLinkPreviews,
  hasMediaCameraPermissions,
  hasMediaPermissions,
  hasMessageAudio,
  hasMinimizeToAndStartInSystemTray,
  hasMinimizeToSystemTray,
  hasNotificationAttention,
  hasNotifications,
  hasReadReceipts,
  hasRelayCalls,
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
  isNotificationAttentionSupported,
  isSyncSupported,
  isSystemTraySupported,
  isMinimizeToAndStartInSystemTraySupported,
  isInternalUser,
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
  onBackupKeyViewedChange,
  onCallNotificationsChange,
  onCallRingtoneNotificationChange,
  onContentProtectionChange,
  onCountMutedConversationsChange,
  onEmojiSkinToneDefaultChange,
  onHasStoriesDisabledChanged,
  onHideMenuBarChange,
  onIncomingCallNotificationsChange,
  onKeepMutedChatsArchivedChange,
  onLastSyncTimeChange,
  onLocaleChange,
  onMediaCameraPermissionsChange,
  onMediaPermissionsChange,
  onMessageAudioChange,
  onMinimizeToAndStartInSystemTrayChange,
  onMinimizeToSystemTrayChange,
  onNotificationAttentionChange,
  onNotificationContentChange,
  onNotificationsChange,
  onRelayCallsChange,
  onSelectedCameraChange,
  onSelectedMicrophoneChange,
  onSelectedSpeakerChange,
  onSentMediaQualityChange,
  onSpellCheckChange,
  onTextFormattingChange,
  onThemeChange,
  onToggleNavTabsCollapse,
  onUniversalExpireTimerChange,
  onWhoCanSeeMeChange,
  onWhoCanFindMeChange,
  onZoomFactorChange,
  otherTabsUnreadStats,
  page,
  phoneNumber = '',
  pickLocalBackupFolder,
  preferredSystemLocales,
  preferredWidthFromStorage,
  refreshCloudBackupStatus,
  refreshBackupSubscriptionStatus,
  removeCustomColor,
  removeCustomColorOnConversations,
  renderDonationsPane,
  renderProfileEditor,
  renderToastManager,
  renderUpdateDialog,
  renderPreferencesChatFoldersPage,
  renderPreferencesEditChatFolderPage,
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
  setPage,
  shouldShowUpdateDialog,
  showToast,
  localeOverride,
  theme,
  themeSetting,
  universalExpireTimer = DurationInSeconds.ZERO,
  validateBackup,
  whoCanFindMe,
  whoCanSeeMe,
  zoomFactor,
  donationReceipts,
  internalAddDonationReceipt,
  saveAttachmentToDisk,
  generateDonationReceiptBlob,
  __dangerouslyRunAbitraryReadOnlySqlQuery,
}: PropsType): JSX.Element {
  const storiesId = useId();
  const themeSelectId = useId();
  const zoomSelectId = useId();
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

  const [editChatFolderPageId, setEditChatFolderPageId] =
    useState<ChatFolderId | null>(null);

  const handleOpenEditChatFoldersPage = useCallback(
    (chatFolderId: ChatFolderId | null) => {
      setPage(SettingsPage.EditChatFolder);
      setEditChatFolderPageId(chatFolderId);
    },
    [setPage]
  );

  const handleCloseEditChatFoldersPage = useCallback(() => {
    setPage(SettingsPage.ChatFolders);
    setEditChatFolderPageId(null);
  }, [setPage]);

  function closeLanguageDialog() {
    setLanguageDialog(null);
    setSelectedLanguageLocale(localeOverride);
  }
  const shouldShowBackupsPage =
    backupFeatureEnabled || backupLocalBackupsEnabled;

  if (page === SettingsPage.Backups && !shouldShowBackupsPage) {
    setPage(SettingsPage.General);
  }
  if (isDonationsPage(page) && !donationsFeatureEnabled) {
    setPage(SettingsPage.General);
  }
  if (page === SettingsPage.Internal && !isInternalUser) {
    setPage(SettingsPage.General);
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
      if (value === 'undefined') {
        onSelectedMicrophoneChange(undefined);
      } else {
        onSelectedMicrophoneChange(availableMicrophones[parseInt(value, 10)]);
      }
    },
    [onSelectedMicrophoneChange, availableMicrophones]
  );

  const handleContentProtectionChange = useCallback(
    (value: boolean) => {
      if (value === true || !isContentProtectionNeeded) {
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
  }, [page]);

  const onAudioOutputSelectChange = useCallback(
    (value: string) => {
      if (value === 'undefined') {
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

  if (page === SettingsPage.Profile) {
    content = renderProfileEditor({
      contentsRef: settingsPaneRef,
    });
  } else if (page === SettingsPage.General) {
    const pageContents = (
      <>
        <SettingsRow>
          <FlowingControl>
            <div className="Preferences__half-flow">
              {i18n('icu:Preferences--phone-number')}
            </div>
            <div
              className={classNames(
                'Preferences__flow-value',
                'Preferences__half-flow',
                'Preferences__half-flow--align-right'
              )}
            >
              {phoneNumber}
            </div>
          </FlowingControl>
          <FlowingControl>
            <div className="Preferences__half-flow">
              {i18n('icu:Preferences--device-name')}
            </div>
            <div
              className={classNames(
                'Preferences__flow-value',
                'Preferences__half-flow',
                'Preferences__half-flow--align-right'
              )}
            >
              {deviceName}
            </div>
            <div
              className={classNames(
                'Preferences__device-name-description',
                'Preferences__description',
                'Preferences__full-flow'
              )}
            >
              {i18n('icu:Preferences--device-name__description')}
            </div>
          </FlowingControl>
        </SettingsRow>
        <SettingsRow title={i18n('icu:Preferences--system')}>
          {isAutoLaunchSupported && (
            <Checkbox
              checked={hasAutoLaunch}
              disabled={hasAutoLaunch === undefined}
              label={i18n('icu:autoLaunchDescription')}
              moduleClassName="Preferences__checkbox"
              name="autoLaunch"
              onChange={onAutoLaunchChange}
            />
          )}
          {isHideMenuBarSupported && (
            <Checkbox
              checked={hasHideMenuBar}
              label={i18n('icu:hideMenuBar')}
              moduleClassName="Preferences__checkbox"
              name="hideMenuBar"
              onChange={onHideMenuBarChange}
            />
          )}
          {isSystemTraySupported && (
            <>
              <Checkbox
                checked={hasMinimizeToSystemTray}
                disabled={hasMinimizeToSystemTray === undefined}
                label={i18n('icu:SystemTraySetting__minimize-to-system-tray')}
                moduleClassName="Preferences__checkbox"
                name="system-tray-setting-minimize-to-system-tray"
                onChange={onMinimizeToSystemTrayChange}
              />
              {isMinimizeToAndStartInSystemTraySupported && (
                <Checkbox
                  checked={hasMinimizeToAndStartInSystemTray}
                  disabled={
                    !hasMinimizeToSystemTray ||
                    hasMinimizeToAndStartInSystemTray === undefined
                  }
                  label={i18n(
                    'icu:SystemTraySetting__minimize-to-and-start-in-system-tray'
                  )}
                  moduleClassName="Preferences__checkbox"
                  name="system-tray-setting-minimize-to-and-start-in-system-tray"
                  onChange={onMinimizeToAndStartInSystemTrayChange}
                />
              )}
            </>
          )}
        </SettingsRow>
        <SettingsRow title={i18n('icu:permissions')}>
          <Checkbox
            checked={hasMediaPermissions}
            disabled={hasMediaPermissions === undefined}
            label={i18n('icu:mediaPermissionsDescription')}
            moduleClassName="Preferences__checkbox"
            name="mediaPermissions"
            onChange={onMediaPermissionsChange}
          />
          <Checkbox
            checked={hasMediaCameraPermissions ?? false}
            disabled={hasMediaCameraPermissions === undefined}
            label={i18n('icu:mediaCameraPermissionsDescription')}
            moduleClassName="Preferences__checkbox"
            name="mediaCameraPermissions"
            onChange={onMediaCameraPermissionsChange}
          />
        </SettingsRow>
        {isAutoDownloadUpdatesSupported && (
          <SettingsRow title={i18n('icu:Preferences--updates')}>
            <Checkbox
              checked={hasAutoDownloadUpdate}
              label={i18n('icu:Preferences__download-update')}
              moduleClassName="Preferences__checkbox"
              name="autoDownloadUpdate"
              onChange={onAutoDownloadUpdateChange}
            />
          </SettingsRow>
        )}
      </>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--general')}
      />
    );
  } else if (isDonationsPage(page)) {
    content = renderDonationsPane({
      contentsRef: settingsPaneRef,
      page,
      setPage,
    });
  } else if (page === SettingsPage.Appearance) {
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
      <SettingsRow>
        <Control
          icon="Preferences__LanguageIcon"
          left={i18n('icu:Preferences__Language__Label')}
          right={
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
                placeholder={i18n('icu:Preferences__Language__SearchLanguages')}
                moduleClassName="Preferences__LanguageModal__SearchInput"
                onChange={event => {
                  setLanguageSearchInput(event.currentTarget.value);
                }}
              />
            }
            modalFooter={
              <>
                <Button
                  variant={ButtonVariant.Secondary}
                  onClick={closeLanguageDialog}
                >
                  {i18n('icu:cancel')}
                </Button>
                <Button
                  variant={ButtonVariant.Primary}
                  disabled={selectedLanguageLocale === localeOverride}
                  onClick={() => {
                    setLanguageDialog(LanguageDialog.Confirmation);
                  }}
                >
                  {i18n('icu:Preferences__LanguageModal__Set')}
                </Button>
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
          <ConfirmationDialog
            dialogName="Preferences__Language"
            i18n={i18n}
            title={i18n('icu:Preferences__LanguageModal__Restart__Title')}
            onCancel={closeLanguageDialog}
            onClose={closeLanguageDialog}
            cancelText={i18n('icu:cancel')}
            actions={[
              {
                text: i18n('icu:Preferences__LanguageModal__Restart__Button'),
                style: 'affirmative',
                action: () => {
                  onLocaleChange(selectedLanguageLocale);
                },
              },
            ]}
          >
            {i18n('icu:Preferences__LanguageModal__Restart__Description')}
          </ConfirmationDialog>
        )}
        <Control
          icon
          left={
            <label htmlFor={themeSelectId}>
              {i18n('icu:Preferences--theme')}
            </label>
          }
          right={
            <Select
              id={themeSelectId}
              disabled={themeSetting === undefined}
              onChange={onThemeChange}
              options={[
                {
                  text: i18n('icu:themeSystem'),
                  value: 'system',
                },
                {
                  text: i18n('icu:themeLight'),
                  value: 'light',
                },
                {
                  text: i18n('icu:themeDark'),
                  value: 'dark',
                },
              ]}
              value={themeSetting}
            />
          }
        />
        <Control
          icon
          left={i18n('icu:showChatColorEditor')}
          onClick={() => {
            setPage(SettingsPage.ChatColor);
          }}
          right={
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
        <Control
          icon
          left={
            <label htmlFor={zoomSelectId}>
              {i18n('icu:Preferences--zoom')}
            </label>
          }
          right={
            <Select
              id={zoomSelectId}
              disabled={zoomFactor === undefined}
              onChange={onZoomSelectChange}
              options={zoomFactor === undefined ? [] : zoomFactors}
              value={zoomFactor}
            />
          }
        />
      </SettingsRow>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--appearance')}
      />
    );
  } else if (page === SettingsPage.Chats) {
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
      <>
        <SettingsRow title={i18n('icu:Preferences__button--chats')}>
          <Checkbox
            checked={hasSpellCheck}
            disabled={hasSpellCheck === undefined}
            description={spellCheckDirtyText}
            label={i18n('icu:spellCheckDescription')}
            moduleClassName="Preferences__checkbox"
            name="spellcheck"
            onChange={onSpellCheckChange}
          />
          <Checkbox
            checked={hasTextFormatting}
            label={i18n('icu:textFormattingDescription')}
            moduleClassName="Preferences__checkbox"
            name="textFormatting"
            onChange={onTextFormattingChange}
          />
          <Checkbox
            checked={hasLinkPreviews}
            description={i18n('icu:Preferences__link-previews--description')}
            disabled
            label={i18n('icu:Preferences__link-previews--title')}
            moduleClassName="Preferences__checkbox"
            name="linkPreviews"
            onChange={noop}
          />
          <Checkbox
            checked={hasAutoConvertEmoji}
            description={
              <I18n
                i18n={i18n}
                id="icu:Preferences__auto-convert-emoji--description"
              />
            }
            label={i18n('icu:Preferences__auto-convert-emoji--title')}
            moduleClassName="Preferences__checkbox"
            name="autoConvertEmoji"
            onChange={onAutoConvertEmojiChange}
          />
          <Checkbox
            checked={hasKeepMutedChatsArchived}
            description={i18n(
              'icu:Preferences__keep-muted-chats-archived--description'
            )}
            label={i18n('icu:Preferences__keep-muted-chats-archived--title')}
            moduleClassName="Preferences__checkbox"
            name="keepMutedChatsArchived"
            onChange={onKeepMutedChatsArchivedChange}
          />
          <SettingsRow>
            <Control
              left={i18n('icu:Preferences__EmojiSkinToneDefaultSetting__Label')}
              right={
                <FunSkinTonesList
                  i18n={i18n}
                  // Raised Hand
                  emoji={emojiParentKeyConstant('\u{270B}')}
                  skinTone={emojiSkinToneDefault}
                  onSelectSkinTone={onEmojiSkinToneDefaultChange}
                />
              }
            />
          </SettingsRow>
        </SettingsRow>
        {isChatFoldersEnabled() && (
          <SettingsRow
            title={i18n(
              'icu:Preferences__ChatsPage__ChatFoldersSection__Title'
            )}
          >
            <Control
              left={
                <>
                  <div>
                    {i18n(
                      'icu:Preferences__ChatsPage__ChatFoldersSection__AddChatFolderItem__Title'
                    )}
                  </div>
                  <div className="Preferences__description">
                    {i18n(
                      'icu:Preferences__ChatsPage__ChatFoldersSection__AddChatFolderItem__Description'
                    )}
                  </div>
                </>
              }
              right={null}
              onClick={() => setPage(SettingsPage.ChatFolders)}
            />
          </SettingsRow>
        )}

        {isSyncSupported && (
          <SettingsRow>
            <Control
              left={
                <>
                  <div>{i18n('icu:sync')}</div>
                  <div className="Preferences__description">
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
              right={
                <div className="Preferences__right-button">
                  <Button
                    aria-label={
                      nowSyncing ? i18n('icu:syncing') : i18n('icu:syncNow')
                    }
                    aria-live="polite"
                    disabled={nowSyncing}
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
                    variant={ButtonVariant.SecondaryAffirmative}
                  >
                    {nowSyncing ? (
                      <Spinner svgSize="small" />
                    ) : (
                      i18n('icu:syncNow')
                    )}
                  </Button>
                </div>
              }
            />
          </SettingsRow>
        )}
      </>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--chats')}
      />
    );
  } else if (page === SettingsPage.Calls) {
    const pageContents = (
      <>
        <SettingsRow title={i18n('icu:calling')}>
          <Checkbox
            checked={hasIncomingCallNotifications}
            label={i18n('icu:incomingCallNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="incomingCallNotification"
            onChange={onIncomingCallNotificationsChange}
          />
          <Checkbox
            checked={hasCallRingtoneNotification}
            label={i18n('icu:callRingtoneNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="callRingtoneNotification"
            onChange={onCallRingtoneNotificationChange}
          />
        </SettingsRow>
        <SettingsRow title={i18n('icu:Preferences__devices')}>
          <Control
            left={
              <>
                <label className="Preferences__select-title" htmlFor="video">
                  {i18n('icu:callingDeviceSelection__label--video')}
                </label>
                <Select
                  ariaLabel={i18n('icu:callingDeviceSelection__label--video')}
                  disabled={!availableCameras.length}
                  moduleClassName="Preferences__select"
                  name="video"
                  onChange={onSelectedCameraChange}
                  options={
                    availableCameras.length
                      ? availableCameras.map(device => ({
                          text: localizeDefault(i18n, device.label),
                          value: device.deviceId,
                        }))
                      : [
                          {
                            text: i18n(
                              'icu:callingDeviceSelection__select--no-device'
                            ),
                            value: 'undefined',
                          },
                        ]
                  }
                  value={selectedCamera}
                />
              </>
            }
            right={<div />}
          />
          <Control
            left={
              <>
                <label
                  className="Preferences__select-title"
                  htmlFor="audio-input"
                >
                  {i18n('icu:callingDeviceSelection__label--audio-input')}
                </label>
                <Select
                  ariaLabel={i18n(
                    'icu:callingDeviceSelection__label--audio-input'
                  )}
                  disabled={!availableMicrophones.length}
                  moduleClassName="Preferences__select"
                  name="audio-input"
                  onChange={onAudioInputSelectChange}
                  options={
                    availableMicrophones.length
                      ? availableMicrophones.map(device => ({
                          text: localizeDefault(i18n, device.name),
                          value: device.index,
                        }))
                      : [
                          {
                            text: i18n(
                              'icu:callingDeviceSelection__select--no-device'
                            ),
                            value: 'undefined',
                          },
                        ]
                  }
                  value={selectedMicrophone?.index}
                />
              </>
            }
            right={<div />}
          />
          <Control
            left={
              <>
                <label
                  className="Preferences__select-title"
                  htmlFor="audio-output"
                >
                  {i18n('icu:callingDeviceSelection__label--audio-output')}
                </label>
                <Select
                  ariaLabel={i18n(
                    'icu:callingDeviceSelection__label--audio-output'
                  )}
                  disabled={!availableSpeakers.length}
                  moduleClassName="Preferences__select"
                  name="audio-output"
                  onChange={onAudioOutputSelectChange}
                  options={
                    availableSpeakers.length
                      ? availableSpeakers.map(device => ({
                          text: localizeDefault(i18n, device.name),
                          value: device.index,
                        }))
                      : [
                          {
                            text: i18n(
                              'icu:callingDeviceSelection__select--no-device'
                            ),
                            value: 'undefined',
                          },
                        ]
                  }
                  value={selectedSpeaker?.index}
                />
              </>
            }
            right={<div />}
          />
        </SettingsRow>
        <SettingsRow title={i18n('icu:Preferences--advanced')}>
          <Checkbox
            checked={hasRelayCalls}
            description={i18n('icu:alwaysRelayCallsDetail')}
            label={i18n('icu:alwaysRelayCallsDescription')}
            moduleClassName="Preferences__checkbox"
            name="relayCalls"
            onChange={onRelayCallsChange}
          />
        </SettingsRow>
      </>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--calls')}
      />
    );
  } else if (page === SettingsPage.Notifications) {
    const pageContents = (
      <>
        <SettingsRow>
          <Checkbox
            checked={hasNotifications}
            label={i18n('icu:Preferences__enable-notifications')}
            moduleClassName="Preferences__checkbox"
            name="notifications"
            onChange={onNotificationsChange}
          />
          <Checkbox
            checked={hasCallNotifications}
            label={i18n('icu:callSystemNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="callSystemNotification"
            onChange={onCallNotificationsChange}
          />
          {isNotificationAttentionSupported && (
            <Checkbox
              checked={hasNotificationAttention}
              label={i18n('icu:notificationDrawAttention')}
              moduleClassName="Preferences__checkbox"
              name="notificationDrawAttention"
              onChange={onNotificationAttentionChange}
            />
          )}
          <Checkbox
            checked={hasCountMutedConversations}
            label={i18n('icu:countMutedConversationsDescription')}
            moduleClassName="Preferences__checkbox"
            name="countMutedConversations"
            onChange={onCountMutedConversationsChange}
          />
        </SettingsRow>
        <SettingsRow>
          <Control
            left={i18n('icu:Preferences--notification-content')}
            right={
              <Select
                ariaLabel={i18n('icu:Preferences--notification-content')}
                disabled={!hasNotifications}
                onChange={onNotificationContentChange}
                options={[
                  {
                    text: i18n('icu:nameAndMessage'),
                    value: 'message',
                  },
                  {
                    text: i18n('icu:nameOnly'),
                    value: 'name',
                  },
                  {
                    text: i18n('icu:noNameOrMessage'),
                    value: 'count',
                  },
                ]}
                value={notificationContent}
              />
            }
          />
        </SettingsRow>
        <SettingsRow>
          <Checkbox
            checked={hasAudioNotifications}
            label={i18n('icu:audioNotificationDescription')}
            moduleClassName="Preferences__checkbox"
            name="audioNotification"
            onChange={onAudioNotificationsChange}
          />
          <Checkbox
            checked={hasMessageAudio}
            description={i18n('icu:Preferences__message-audio-description')}
            label={i18n('icu:Preferences__message-audio-title')}
            moduleClassName="Preferences__checkbox"
            name="messageAudio"
            onChange={onMessageAudioChange}
          />
        </SettingsRow>
      </>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--notifications')}
      />
    );
  } else if (page === SettingsPage.Privacy) {
    const isCustomDisappearingMessageValue =
      !DEFAULT_DURATIONS_SET.has(universalExpireTimer);
    const pageContents = (
      <>
        <SettingsRow>
          <FlowingControl>
            <div
              className={classNames(
                'Preferences__pnp',
                'Preferences__two-thirds-flow'
              )}
            >
              <h3>{i18n('icu:Preferences__pnp__row--title')}</h3>
              <div className="Preferences__description">
                {i18n('icu:Preferences__pnp__row--body')}
              </div>
            </div>
            <div
              className={classNames(
                'Preferences__pnp',
                'Preferences__flow-button',
                'Preferences__one-third-flow',
                'Preferences__one-third-flow--align-right'
              )}
            >
              <Button
                onClick={() => setPage(SettingsPage.PNP)}
                variant={ButtonVariant.Secondary}
              >
                {i18n('icu:Preferences__pnp__row--button')}
              </Button>
            </div>
          </FlowingControl>
        </SettingsRow>
        <SettingsRow>
          <Control
            left={i18n('icu:Preferences--blocked')}
            right={i18n('icu:Preferences--blocked-count', {
              num: blockedCount,
            })}
          />
        </SettingsRow>
        <SettingsRow title={i18n('icu:Preferences--messaging')}>
          <Checkbox
            checked={hasReadReceipts}
            disabled
            label={i18n('icu:Preferences--read-receipts')}
            moduleClassName="Preferences__checkbox"
            name="readReceipts"
            onChange={noop}
          />
          <Checkbox
            checked={hasTypingIndicators}
            disabled
            label={i18n('icu:Preferences--typing-indicators')}
            moduleClassName="Preferences__checkbox"
            name="typingIndicators"
            onChange={noop}
          />
          <div className="Preferences__padding">
            <div className="Preferences__description">
              {i18n('icu:Preferences__privacy--description')}
            </div>
          </div>
        </SettingsRow>
        {showDisappearingTimerDialog && (
          <DisappearingTimeDialog
            i18n={i18n}
            initialValue={universalExpireTimer}
            onClose={() => setShowDisappearingTimerDialog(false)}
            onSubmit={onUniversalExpireTimerChange}
          />
        )}
        <SettingsRow title={i18n('icu:disappearingMessages')}>
          <FlowingControl>
            <div className="Preferences__two-thirds-flow">
              <div>
                {i18n('icu:settings__DisappearingMessages__timer__label')}
              </div>
              <div className="Preferences__description">
                {i18n('icu:settings__DisappearingMessages__footer')}
              </div>
            </div>
            <div
              className={classNames(
                'Preferences__flow-button',
                'Preferences__one-third-flow',
                'Preferences__one-third-flow--align-right'
              )}
            >
              <Select
                ariaLabel={i18n(
                  'icu:settings__DisappearingMessages__timer__label'
                )}
                onChange={value => {
                  if (
                    value === String(universalExpireTimer) ||
                    value === '-1'
                  ) {
                    setShowDisappearingTimerDialog(true);
                    return;
                  }

                  onUniversalExpireTimerChange(parseInt(value, 10));
                }}
                options={DEFAULT_DURATIONS_IN_SECONDS.map(seconds => {
                  const text = formatExpirationTimer(i18n, seconds, {
                    capitalizeOff: true,
                  });
                  return {
                    value: seconds,
                    text,
                  };
                }).concat([
                  {
                    value: isCustomDisappearingMessageValue
                      ? universalExpireTimer
                      : DurationInSeconds.fromSeconds(-1),
                    text: isCustomDisappearingMessageValue
                      ? formatExpirationTimer(i18n, universalExpireTimer)
                      : i18n('icu:selectedCustomDisappearingTimeOption'),
                  },
                ])}
                value={universalExpireTimer}
              />
            </div>
          </FlowingControl>
        </SettingsRow>
        {isContentProtectionSupported && (
          <SettingsRow title={i18n('icu:Preferences__Privacy__Application')}>
            <Checkbox
              checked={hasContentProtection}
              disabled={hasContentProtection === undefined}
              description={i18n(
                'icu:Preferences__content-protection--description'
              )}
              label={i18n('icu:Preferences__content-protection--label')}
              moduleClassName="Preferences__checkbox"
              name="contentProtection"
              onChange={handleContentProtectionChange}
            />
          </SettingsRow>
        )}
        {confirmContentProtection ? (
          <ConfirmationDialog
            dialogName="Preference.confirmContentProtection"
            actions={[
              {
                action: () => onContentProtectionChange(false),
                style: 'negative',
                text: i18n(
                  'icu:Preferences__content-protection__modal--disable'
                ),
              },
            ]}
            i18n={i18n}
            onClose={() => {
              setConfirmContentProtection(false);
            }}
            title={i18n('icu:Preferences__content-protection__modal--title')}
          >
            {i18n('icu:Preferences__content-protection__modal--body')}
          </ConfirmationDialog>
        ) : null}
        <SettingsRow title={i18n('icu:Stories__title')}>
          <FlowingControl>
            <div className="Preferences__two-thirds-flow">
              <label htmlFor={storiesId}>
                <div>{i18n('icu:Stories__settings-toggle--title')}</div>
                <div className="Preferences__description">
                  {i18n('icu:Stories__settings-toggle--description')}
                </div>
              </label>
            </div>
            <div
              className={classNames(
                'Preferences__flow-button',
                'Preferences__one-third-flow',
                'Preferences__one-third-flow--align-right'
              )}
            >
              {hasStoriesDisabled ? (
                <Button
                  onClick={() => onHasStoriesDisabledChanged(false)}
                  variant={ButtonVariant.Secondary}
                >
                  {i18n('icu:Preferences__turn-stories-on')}
                </Button>
              ) : (
                <Button
                  className="Preferences__stories-off"
                  onClick={() => setConfirmStoriesOff(true)}
                  variant={ButtonVariant.SecondaryDestructive}
                >
                  {i18n('icu:Preferences__turn-stories-off')}
                </Button>
              )}
            </div>
          </FlowingControl>
        </SettingsRow>
        <SettingsRow>
          <FlowingControl>
            <div
              className={classNames(
                'Preferences__pnp',
                'Preferences__two-thirds-flow'
              )}
            >
              <div>{i18n('icu:clearDataHeader')}</div>
              <div className="Preferences__description">
                {i18n('icu:clearDataExplanation')}
              </div>
            </div>

            <div
              className={classNames(
                'Preferences__pnp',
                'Preferences__flow-button',
                'Preferences__one-third-flow',
                'Preferences__one-third-flow--align-right'
              )}
            >
              <Button
                onClick={() => setConfirmDelete(true)}
                variant={ButtonVariant.SecondaryDestructive}
              >
                {i18n('icu:clearDataButton')}
              </Button>
            </div>
          </FlowingControl>
        </SettingsRow>
        {confirmDelete ? (
          <ConfirmationDialog
            dialogName="Preference.deleteAllData"
            actions={[
              {
                action: doDeleteAllData,
                style: 'negative',
                text: i18n('icu:clearDataButton'),
              },
            ]}
            i18n={i18n}
            onClose={() => {
              setConfirmDelete(false);
            }}
            title={i18n('icu:deleteAllDataHeader')}
          >
            {i18n('icu:deleteAllDataBody')}
          </ConfirmationDialog>
        ) : null}
        {confirmStoriesOff ? (
          <ConfirmationDialog
            dialogName="Preference.turnStoriesOff"
            actions={[
              {
                action: () => onHasStoriesDisabledChanged(true),
                style: 'negative',
                text: i18n('icu:Preferences__turn-stories-off--action'),
              },
            ]}
            i18n={i18n}
            onClose={() => {
              setConfirmStoriesOff(false);
            }}
          >
            {i18n('icu:Preferences__turn-stories-off--body')}
          </ConfirmationDialog>
        ) : null}
      </>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--privacy')}
      />
    );
  } else if (page === SettingsPage.DataUsage) {
    const pageContents = (
      <>
        <SettingsRow title={i18n('icu:Preferences__media-auto-download')}>
          <Checkbox
            checked={autoDownloadAttachment.photos !== false}
            label={i18n('icu:Preferences__media-auto-download__photos')}
            moduleClassName="Preferences__checkbox"
            name="autoLaunch"
            onChange={(newValue: boolean) =>
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                photos: newValue,
              })
            }
          />
          <Checkbox
            checked={autoDownloadAttachment.videos !== false}
            label={i18n('icu:Preferences__media-auto-download__videos')}
            moduleClassName="Preferences__checkbox"
            name="autoLaunch"
            onChange={(newValue: boolean) =>
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                videos: newValue,
              })
            }
          />
          <Checkbox
            checked={autoDownloadAttachment.audio !== false}
            label={i18n('icu:Preferences__media-auto-download__audio')}
            moduleClassName="Preferences__checkbox"
            name="autoLaunch"
            onChange={(newValue: boolean) =>
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                audio: newValue,
              })
            }
          />
          <Checkbox
            checked={autoDownloadAttachment.documents !== false}
            label={i18n('icu:Preferences__media-auto-download__documents')}
            moduleClassName="Preferences__checkbox"
            name="autoLaunch"
            onChange={(newValue: boolean) =>
              onAutoDownloadAttachmentChange({
                ...autoDownloadAttachment,
                documents: newValue,
              })
            }
          />
          <div className="Preferences__padding">
            <div
              className={classNames(
                'Preferences__description',
                'Preferences__description--medium'
              )}
            >
              {i18n('icu:Preferences__media-auto-download__description')}
            </div>
          </div>
        </SettingsRow>
        <SettingsRow>
          <FlowingControl>
            <div className="Preferences__two-thirds-flow">
              <div className="Preferences__option-name">
                {i18n('icu:Preferences__sent-media-quality')}
              </div>
              <div
                className={classNames(
                  'Preferences__description',
                  'Preferences__description--medium'
                )}
              >
                {i18n('icu:Preferences__sent-media-quality__description')}
              </div>
            </div>

            <div
              className={classNames(
                'Preferences__flow-button',
                'Preferences__one-third-flow',
                'Preferences__one-third-flow--align-right'
              )}
            >
              <Select
                onChange={onSentMediaQualityChange}
                options={[
                  {
                    text: i18n('icu:sentMediaQualityStandard'),
                    value: 'standard',
                  },
                  {
                    text: i18n('icu:sentMediaQualityHigh'),
                    value: 'high',
                  },
                ]}
                value={sentMediaQualitySetting}
              />
            </div>
          </FlowingControl>
        </SettingsRow>
      </>
    );
    content = (
      <PreferencesContent
        contents={pageContents}
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--data-usage')}
      />
    );
  } else if (page === SettingsPage.ChatColor) {
    const backButton = (
      <button
        aria-label={i18n('icu:goBack')}
        className="Preferences__back-icon"
        onClick={() => setPage(SettingsPage.Appearance)}
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
  } else if (page === SettingsPage.ChatFolders) {
    content = renderPreferencesChatFoldersPage({
      onBack: () => setPage(SettingsPage.Chats),
      onOpenEditChatFoldersPage: handleOpenEditChatFoldersPage,
      settingsPaneRef,
    });
  } else if (page === SettingsPage.EditChatFolder) {
    content = renderPreferencesEditChatFolderPage({
      onBack: handleCloseEditChatFoldersPage,
      settingsPaneRef,
      existingChatFolderId: editChatFolderPageId,
    });
  } else if (page === SettingsPage.PNP) {
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
        onClick={() => setPage(SettingsPage.Privacy)}
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
        {confirmPnpNotDiscoverable && (
          <ConfirmationDialog
            i18n={i18n}
            title={i18n(
              'icu:Preferences__pnp__discoverability__nobody__confirmModal__title'
            )}
            dialogName="Preference.turnPnpDiscoveryOff"
            onClose={() => {
              setConfirmPnpNoDiscoverable(false);
            }}
            actions={[
              {
                action: () =>
                  onWhoCanFindMeChange(
                    PhoneNumberDiscoverability.NotDiscoverable
                  ),
                style: 'affirmative',
                text: i18n('icu:ok'),
              },
            ]}
          >
            {i18n(
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
          </ConfirmationDialog>
        )}
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
  } else if (isBackupPage(page)) {
    let pageTitle: string | undefined;
    if (page === SettingsPage.Backups || page === SettingsPage.BackupsDetails) {
      pageTitle = i18n('icu:Preferences__button--backups');
    } else if (page === SettingsPage.LocalBackups) {
      pageTitle = i18n('icu:Preferences__local-backups');
    }
    // Local backups setup page titles intentionally left blank

    let backPage: PreferencesBackupPage | undefined;
    if (page === SettingsPage.LocalBackupsKeyReference) {
      backPage = SettingsPage.LocalBackups;
    } else if (page !== SettingsPage.Backups) {
      backPage = SettingsPage.Backups;
    }
    let backButton: JSX.Element | undefined;
    if (backPage) {
      backButton = (
        <button
          aria-label={i18n('icu:goBack')}
          className="Preferences__back-icon"
          onClick={() => setPage(backPage)}
          type="button"
        />
      );
    }
    const pageContents = (
      <PreferencesBackups
        accountEntropyPool={accountEntropyPool}
        backupKeyViewed={backupKeyViewed}
        backupSubscriptionStatus={backupSubscriptionStatus}
        backupMediaDownloadStatus={backupMediaDownloadStatus}
        cancelBackupMediaDownload={cancelBackupMediaDownload}
        pauseBackupMediaDownload={pauseBackupMediaDownload}
        resumeBackupMediaDownload={resumeBackupMediaDownload}
        cloudBackupStatus={cloudBackupStatus}
        i18n={i18n}
        locale={resolvedLocale}
        localBackupFolder={localBackupFolder}
        onBackupKeyViewedChange={onBackupKeyViewedChange}
        pickLocalBackupFolder={pickLocalBackupFolder}
        page={page}
        promptOSAuth={promptOSAuth}
        refreshCloudBackupStatus={refreshCloudBackupStatus}
        refreshBackupSubscriptionStatus={refreshBackupSubscriptionStatus}
        setPage={setPage}
        showToast={showToast}
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
  } else if (page === SettingsPage.Internal) {
    content = (
      <PreferencesContent
        contents={
          <PreferencesInternal
            i18n={i18n}
            exportLocalBackup={exportLocalBackup}
            validateBackup={validateBackup}
            getMessageCountBySchemaVersion={getMessageCountBySchemaVersion}
            getMessageSampleForSchemaVersion={getMessageSampleForSchemaVersion}
            donationReceipts={donationReceipts}
            internalAddDonationReceipt={internalAddDonationReceipt}
            saveAttachmentToDisk={saveAttachmentToDisk}
            generateDonationReceiptBlob={generateDonationReceiptBlob}
            __dangerouslyRunAbitraryReadOnlySqlQuery={
              __dangerouslyRunAbitraryReadOnlySqlQuery
            }
          />
        }
        contentsRef={settingsPaneRef}
        title={i18n('icu:Preferences__button--internal')}
      />
    );
  }

  return (
    <FunEmojiLocalizationProvider i18n={i18n}>
      <div className="module-title-bar-drag-area" />
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
                    page === SettingsPage.Profile,
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
                    // `sharedGroupNames` makes no sense for yourself, but
                    // `<Avatar>` needs it to determine blurring.
                    sharedGroupNames={[]}
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
                    setPage(SettingsPage.Profile);
                  }}
                >
                  <span className="Preferences__profile-chip__screenreader-only">
                    {i18n('icu:ProfileEditor__open')}
                  </span>
                </button>
                <button
                  type="button"
                  className="Preferences__profile-chip__qr-icon-button"
                  aria-label={i18n('icu:ProfileEditor__username-link__open')}
                  onClick={() => {
                    setPage(
                      SettingsPage.Profile,
                      ProfileEditorPage.UsernameLink
                    );
                  }}
                >
                  <div className="Preferences__profile-chip__qr-icon" />
                </button>
              </div>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--general': true,
                  'Preferences__button--selected':
                    page === SettingsPage.General,
                })}
                onClick={() => setPage(SettingsPage.General)}
              >
                {i18n('icu:Preferences__button--general')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--appearance': true,
                  'Preferences__button--selected':
                    page === SettingsPage.Appearance ||
                    page === SettingsPage.ChatColor,
                })}
                onClick={() => setPage(SettingsPage.Appearance)}
              >
                {i18n('icu:Preferences__button--appearance')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--chats': true,
                  'Preferences__button--selected': page === SettingsPage.Chats,
                })}
                onClick={() => setPage(SettingsPage.Chats)}
              >
                {i18n('icu:Preferences__button--chats')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--calls': true,
                  'Preferences__button--selected': page === SettingsPage.Calls,
                })}
                onClick={() => setPage(SettingsPage.Calls)}
              >
                {i18n('icu:Preferences__button--calls')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--notifications': true,
                  'Preferences__button--selected':
                    page === SettingsPage.Notifications,
                })}
                onClick={() => setPage(SettingsPage.Notifications)}
              >
                {i18n('icu:Preferences__button--notifications')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--privacy': true,
                  'Preferences__button--selected':
                    page === SettingsPage.Privacy || page === SettingsPage.PNP,
                })}
                onClick={() => setPage(SettingsPage.Privacy)}
              >
                {i18n('icu:Preferences__button--privacy')}
              </button>
              <button
                type="button"
                className={classNames({
                  Preferences__button: true,
                  'Preferences__button--data-usage': true,
                  'Preferences__button--selected':
                    page === SettingsPage.DataUsage,
                })}
                onClick={() => setPage(SettingsPage.DataUsage)}
              >
                {i18n('icu:Preferences__button--data-usage')}
              </button>
              {shouldShowBackupsPage ? (
                <button
                  type="button"
                  className={classNames({
                    Preferences__button: true,
                    'Preferences__button--backups': true,
                    'Preferences__button--selected': isBackupPage(page),
                  })}
                  onClick={() => setPage(SettingsPage.Backups)}
                >
                  {i18n('icu:Preferences__button--backups')}
                </button>
              ) : null}
              {donationsFeatureEnabled && (
                <button
                  type="button"
                  className={classNames({
                    Preferences__button: true,
                    'Preferences__button--donations': true,
                    'Preferences__button--selected': isDonationsPage(page),
                  })}
                  onClick={() => setPage(SettingsPage.Donations)}
                >
                  {i18n('icu:Preferences__button--donate')}
                </button>
              )}
              {isInternalUser ? (
                <button
                  type="button"
                  className={classNames({
                    Preferences__button: true,
                    'Preferences__button--internal': true,
                    'Preferences__button--selected':
                      page === SettingsPage.Internal,
                  })}
                  onClick={() => setPage(SettingsPage.Internal)}
                >
                  {i18n('icu:Preferences__button--internal')}
                </button>
              ) : null}
            </div>
          </div>
        </NavSidebar>
        {content}
      </div>
    </FunEmojiLocalizationProvider>
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
