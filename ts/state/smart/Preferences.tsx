// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';

import type { AudioDevice } from '@signalapp/ringrtc';
import type { MutableRefObject } from 'react';

import { useItemsActions } from '../ducks/items.js';
import { useConversationsActions } from '../ducks/conversations.js';
import {
  getConversationsWithCustomColorSelector,
  getMe,
} from '../selectors/conversations.js';
import {
  getCustomColors,
  getItems,
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
} from '../selectors/items.js';
import { DEFAULT_AUTO_DOWNLOAD_ATTACHMENT } from '../../textsecure/Storage.js';
import { DEFAULT_CONVERSATION_COLOR } from '../../types/Colors.js';
import { isBackupFeatureEnabled } from '../../util/isBackupEnabled.js';
import { format } from '../../types/PhoneNumber.js';
import {
  getIntl,
  getTheme,
  getUserDeviceId,
  getUserNumber,
} from '../selectors/user.js';
import { EmojiSkinTone } from '../../components/fun/data/emojis.js';
import { renderClearingDataView } from '../../shims/renderClearingDataView.js';
import OS from '../../util/os/osPreload.js';
import { themeChanged } from '../../shims/themeChanged.js';
import * as Settings from '../../types/Settings.js';
import * as universalExpireTimerUtil from '../../util/universalExpireTimer.js';
import {
  parseSystemTraySetting,
  shouldMinimizeToSystemTray,
  SystemTraySetting,
} from '../../types/SystemTraySetting.js';
import { calling } from '../../services/calling.js';
import { drop } from '../../util/drop.js';
import { assertDev, strictAssert } from '../../util/assert.js';
import { backupsService } from '../../services/backups/index.js';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.js';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability.js';
import { PhoneNumberSharingMode } from '../../util/phoneNumberSharingMode.js';
import { writeProfile } from '../../services/writeProfile.js';
import { getConversation } from '../../util/getConversation.js';
import { waitForEvent } from '../../shims/events.js';
import { MINUTE } from '../../util/durations/index.js';
import { sendSyncRequests } from '../../textsecure/syncRequests.js';
import { SmartUpdateDialog } from './UpdateDialog.js';
import { Preferences } from '../../components/Preferences.js';
import { useUpdatesActions } from '../ducks/updates.js';
import { getUpdateDialogType } from '../selectors/updates.js';
import { getHasAnyFailedStorySends } from '../selectors/stories.js';
import {
  getOtherTabsUnreadStats,
  getSelectedLocation,
} from '../selectors/nav.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import { SmartProfileEditor } from './ProfileEditor.js';
import { useNavActions } from '../ducks/nav.js';
import { NavTab, ProfileEditorPage, SettingsPage } from '../../types/Nav.js';
import { SmartToastManager } from './ToastManager.js';
import { useToastActions } from '../ducks/toast.js';
import { DataReader } from '../../sql/Client.js';
import { deleteAllMyStories } from '../../util/deleteAllMyStories.js';
import { isLocalBackupsEnabled } from '../../util/isLocalBackupsEnabled.js';
import { SmartPreferencesDonations } from './PreferencesDonations.js';
import { useDonationsActions } from '../ducks/donations.js';
import { generateDonationReceiptBlob } from '../../util/generateDonationReceipt.js';

import type { StorageAccessType, ZoomFactorType } from '../../types/Storage.js';
import type { ThemeType } from '../../util/preload.js';
import type { WidthBreakpoint } from '../../components/_util.js';
import { DialogType } from '../../types/Dialogs.js';
import { promptOSAuth } from '../../util/promptOSAuth.js';
import type { StateType } from '../reducer.js';
import {
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  cancelBackupMediaDownload,
} from '../../util/backupMediaDownload.js';
import { DonationsErrorBoundary } from '../../components/DonationsErrorBoundary.js';
import type { SmartPreferencesChatFoldersPageProps } from './PreferencesChatFoldersPage.js';
import { SmartPreferencesChatFoldersPage } from './PreferencesChatFoldersPage.js';
import type { SmartPreferencesEditChatFolderPageProps } from './PreferencesEditChatFolderPage.js';
import { SmartPreferencesEditChatFolderPage } from './PreferencesEditChatFolderPage.js';
import { isProduction } from '../../util/version.js';
import { AxoProvider } from '../../axo/AxoProvider.js';

const DEFAULT_NOTIFICATION_SETTING = 'message';

function renderUpdateDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartUpdateDialog {...props} disableDismiss />;
}

function renderPreferencesChatFoldersPage(
  props: SmartPreferencesChatFoldersPageProps
): JSX.Element {
  return <SmartPreferencesChatFoldersPage {...props} />;
}

function renderPreferencesEditChatFolderPage(
  props: SmartPreferencesEditChatFolderPageProps
): JSX.Element {
  return <SmartPreferencesEditChatFolderPage {...props} />;
}

function renderProfileEditor(options: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
}): JSX.Element {
  return <SmartProfileEditor contentsRef={options.contentsRef} />;
}

function renderToastManager(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager disableMegaphone {...props} />;
}

function renderDonationsPane({
  contentsRef,
  page,
  setPage,
}: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  page: SettingsPage;
  setPage: (page: SettingsPage) => void;
}): JSX.Element {
  return (
    <DonationsErrorBoundary>
      <SmartPreferencesDonations
        contentsRef={contentsRef}
        page={page}
        setPage={setPage}
      />
    </DonationsErrorBoundary>
  );
}

function getSystemTraySettingValues(
  systemTraySetting: SystemTraySetting | undefined
): {
  hasMinimizeToAndStartInSystemTray: boolean | undefined;
  hasMinimizeToSystemTray: boolean | undefined;
} {
  if (systemTraySetting === undefined) {
    return {
      hasMinimizeToAndStartInSystemTray: undefined,
      hasMinimizeToSystemTray: undefined,
    };
  }

  const parsedSystemTraySetting = parseSystemTraySetting(systemTraySetting);
  const hasMinimizeToAndStartInSystemTray =
    parsedSystemTraySetting ===
    SystemTraySetting.MinimizeToAndStartInSystemTray;
  const hasMinimizeToSystemTray = shouldMinimizeToSystemTray(
    parsedSystemTraySetting
  );

  return {
    hasMinimizeToAndStartInSystemTray,
    hasMinimizeToSystemTray,
  };
}

export function SmartPreferences(): JSX.Element | null {
  const {
    addCustomColor,
    editCustomColor,
    putItem,
    removeCustomColor,
    resetDefaultChatColor,
    savePreferredLeftPaneWidth,
    setEmojiSkinToneDefault: onEmojiSkinToneDefaultChange,
    setGlobalDefaultConversationColor,
    toggleNavTabsCollapse,
  } = useItemsActions();
  const { removeCustomColorOnConversations, resetAllChatColors } =
    useConversationsActions();
  const { startUpdate } = useUpdatesActions();
  const { changeLocation } = useNavActions();
  const { showToast } = useToastActions();
  const { internalAddDonationReceipt } = useDonationsActions();

  // Selectors

  const currentLocation = useSelector(getSelectedLocation);
  const customColors = useSelector(getCustomColors) ?? {};
  const getConversationsWithCustomColor = useSelector(
    getConversationsWithCustomColorSelector
  );
  const i18n = useSelector(getIntl);
  const items = useSelector(getItems);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const dialogType = useSelector(getUpdateDialogType);
  const me = useSelector(getMe);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const preferredWidthFromStorage = useSelector(getPreferredLeftPaneWidth);
  const theme = useSelector(getTheme);
  const donationReceipts = useSelector(
    (state: StateType) => state.donations.receipts
  );

  const shouldShowUpdateDialog = dialogType !== DialogType.None;
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const badge = getPreferredBadge(me.badges);

  // The weird ones

  const makeSyncRequest = async () => {
    const contactSyncComplete = waitForEvent(
      'contactSync:complete',
      5 * MINUTE
    );
    return Promise.all([sendSyncRequests(), contactSyncComplete]);
  };

  const universalExpireTimer = universalExpireTimerUtil.getForRedux(items);
  const onUniversalExpireTimerChange = async (newValue: number) => {
    await universalExpireTimerUtil.set(DurationInSeconds.fromSeconds(newValue));

    // Update account in Storage Service
    const account = window.ConversationController.getOurConversationOrThrow();
    account.captureChange('universalExpireTimer');

    // Add a notification to the currently open conversation
    const state = window.reduxStore.getState();
    const selectedId = state.conversations.selectedConversationId;
    if (selectedId) {
      const conversation = window.ConversationController.get(selectedId);
      assertDev(conversation, "Conversation wasn't found");

      await conversation.updateLastMessage();
    }
  };

  const validateBackup = () => backupsService._internalValidate();
  const exportLocalBackup = () => backupsService._internalExportLocalBackup();
  const pickLocalBackupFolder = () => backupsService.pickLocalBackupFolder();

  const doDeleteAllData = () => renderClearingDataView();
  const refreshCloudBackupStatus =
    window.Signal.Services.backups.throttledFetchCloudBackupStatus;
  const refreshBackupSubscriptionStatus =
    window.Signal.Services.backups.throttledFetchSubscriptionStatus;

  // Context - these don't change per startup

  const version = window.SignalContext.getVersion();
  const availableLocales = window.SignalContext.getI18nAvailableLocales();
  const resolvedLocale = window.SignalContext.getI18nLocale();
  const preferredSystemLocales =
    window.SignalContext.getPreferredSystemLocales();
  const initialSpellCheckSetting =
    window.SignalContext.config.appStartInitialSpellcheckSetting;

  // Settings - these capabilities are unchanging

  const isAutoDownloadUpdatesSupported =
    Settings.isAutoDownloadUpdatesSupported(OS, version);
  const isAutoLaunchSupported = Settings.isAutoLaunchSupported(OS);
  const isHideMenuBarSupported = Settings.isHideMenuBarSupported(OS);
  const isMinimizeToAndStartInSystemTraySupported =
    Settings.isMinimizeToAndStartInSystemTraySupported(OS);
  const isNotificationAttentionSupported =
    Settings.isDrawAttentionSupported(OS);
  const isSystemTraySupported = Settings.isSystemTraySupported(OS);

  // Textsecure - user can change number and change this device's name

  const phoneNumber = format(useSelector(getUserNumber) ?? '', {});
  const isPrimary = useSelector(getUserDeviceId) === 1;
  const isSyncSupported = !isPrimary;

  const [deviceName, setDeviceName] = React.useState(
    window.textsecure.storage.user.getDeviceName()
  );
  useEffect(() => {
    let canceled = false;
    const onDeviceNameChanged = () => {
      const value = window.textsecure.storage.user.getDeviceName();
      if (canceled) {
        return;
      }
      setDeviceName(value);
    };

    window.Whisper.events.on('deviceNameChanged', onDeviceNameChanged);

    return () => {
      canceled = true;
      window.Whisper.events.off('deviceNameChanged', onDeviceNameChanged);
    };
  }, []);

  // RingRTC - the list of devices is unchanging while settings window is open

  // The select boxes for devices are disabled while these arrays have zero length
  const [availableCameras, setAvailableCameras] = React.useState<
    Array<MediaDeviceInfo>
  >([]);
  const [availableMicrophones, setAvailableMicrophones] = React.useState<
    Array<AudioDevice>
  >([]);
  const [availableSpeakers, setAvailableSpeakers] = React.useState<
    Array<AudioDevice>
  >([]);

  useEffect(() => {
    let canceled = false;
    const loadDevices = async () => {
      const {
        availableCameras: cameras,
        availableMicrophones: microphones,
        availableSpeakers: speakers,
      } = await calling.getAvailableIODevices();

      if (canceled) {
        return;
      }
      setAvailableCameras(cameras);
      setAvailableMicrophones(microphones);
      setAvailableSpeakers(speakers);
    };
    drop(loadDevices());

    return () => {
      canceled = true;
    };
  }, []);

  // Ephemeral settings, via async IPC, all can be modiified

  const [localeOverride, setLocaleOverride] = React.useState<string | null>();
  const [systemTraySettings, setSystemTraySettings] =
    React.useState<SystemTraySetting>();
  const [hasContentProtection, setContentProtection] =
    React.useState<boolean>();
  const [hasSpellCheck, setSpellCheck] = React.useState<boolean>();
  const [themeSetting, setThemeSetting] = React.useState<ThemeType>();

  useEffect(() => {
    let canceled = false;

    const loadOverride = async () => {
      const value = await window.Events.getLocaleOverride();
      if (canceled) {
        return;
      }
      setLocaleOverride(value);
    };
    drop(loadOverride());

    const loadSystemTraySettings = async () => {
      const value = await window.Events.getSystemTraySetting();
      if (canceled) {
        return;
      }
      setSystemTraySettings(value);
    };
    drop(loadSystemTraySettings());

    const loadSpellCheck = async () => {
      const value = await window.Events.getSpellCheck();
      if (canceled) {
        return;
      }
      setSpellCheck(value);
    };
    drop(loadSpellCheck());

    const loadContentProtection = async () => {
      const value = await window.Events.getContentProtection();
      setContentProtection(value);
    };
    drop(loadContentProtection());

    const loadThemeSetting = async () => {
      const value = await window.Events.getThemeSetting();
      if (canceled) {
        return;
      }
      setThemeSetting(value);
    };
    drop(loadThemeSetting());

    return () => {
      canceled = true;
    };
  }, []);

  const onLocaleChange = async (locale: string | null | undefined) => {
    setLocaleOverride(locale);
    await window.Events.setLocaleOverride(locale ?? null);
  };

  const { hasMinimizeToAndStartInSystemTray, hasMinimizeToSystemTray } =
    getSystemTraySettingValues(systemTraySettings);

  const onMinimizeToSystemTrayChange = async (value: boolean) => {
    const newSetting = value
      ? SystemTraySetting.MinimizeToSystemTray
      : SystemTraySetting.DoNotUseSystemTray;
    setSystemTraySettings(newSetting);
    await window.Events.setSystemTraySetting(newSetting);
  };
  const onMinimizeToAndStartInSystemTrayChange = async (value: boolean) => {
    const newSetting = value
      ? SystemTraySetting.MinimizeToAndStartInSystemTray
      : SystemTraySetting.MinimizeToSystemTray;
    setSystemTraySettings(newSetting);
    await window.Events.setSystemTraySetting(newSetting);
  };
  const onSpellCheckChange = async (value: boolean) => {
    setSpellCheck(value);
    await window.Events.setSpellCheck(value);
  };
  const onContentProtectionChange = async (value: boolean) => {
    setContentProtection(value);
    await window.Events.setContentProtection(value);
  };
  const onThemeChange = (value: ThemeType) => {
    setThemeSetting(value);
    drop(window.Events.setThemeSetting(value));
    drop(themeChanged());
  };

  // Async IPC for electron configuration, all can be modified

  const [hasAutoLaunch, setAutoLaunch] = React.useState<boolean>();
  const [hasMediaCameraPermissions, setMediaCameraPermissions] =
    React.useState<boolean>();
  const [hasMediaPermissions, setMediaPermissions] = React.useState<boolean>();
  const [zoomFactor, setZoomFactor] = React.useState<ZoomFactorType>();

  useEffect(() => {
    let canceled = false;

    const loadAutoLaunch = async () => {
      const value = await window.Events.getAutoLaunch();
      if (canceled) {
        return;
      }
      setAutoLaunch(value);
    };
    drop(loadAutoLaunch());

    const loadMediaCameraPermissions = async () => {
      const value = await window.Events.getMediaCameraPermissions();
      if (canceled) {
        return;
      }
      setMediaCameraPermissions(value);
    };
    drop(loadMediaCameraPermissions());

    const loadMediaPermissions = async () => {
      const value = await window.Events.getMediaPermissions();
      if (canceled) {
        return;
      }
      setMediaPermissions(value);
    };
    drop(loadMediaPermissions());

    const loadZoomFactor = async () => {
      const value = await window.Events.getZoomFactor();
      if (canceled) {
        return;
      }
      setZoomFactor(value);
    };
    drop(loadZoomFactor());

    // We need to be ready for zoom changes from the keyboard
    const updateZoomFactorFromIpc = (value: ZoomFactorType) => {
      if (canceled) {
        return;
      }
      setZoomFactor(value);
    };
    window.Events.onZoomFactorChange(updateZoomFactorFromIpc);
    return () => {
      canceled = true;
      window.Events.offZoomFactorChange(updateZoomFactorFromIpc);
    };
  }, []);

  const onAutoLaunchChange = async (value: boolean) => {
    setAutoLaunch(value);
    await window.Events.setAutoLaunch(value);
  };
  const onZoomFactorChange = async (value: ZoomFactorType) => {
    setZoomFactor(value);
    await window.Events.setZoomFactor(value);
  };
  const onMediaCameraPermissionsChange = async (value: boolean) => {
    setMediaCameraPermissions(value);
    await window.IPC.setMediaCameraPermissions(value);
  };
  const onMediaPermissionsChange = async (value: boolean) => {
    setMediaPermissions(value);
    await window.IPC.setMediaPermissions(value);
  };

  // Simple, one-way items

  const {
    backupSubscriptionStatus,
    cloudBackupStatus,
    localBackupFolder,
    backupMediaDownloadCompletedBytes,
    backupMediaDownloadTotalBytes,
    attachmentDownloadManagerIdled,
    backupMediaDownloadPaused,
  } = items;
  const defaultConversationColor =
    items.defaultConversationColor || DEFAULT_CONVERSATION_COLOR;
  const hasLinkPreviews = items.linkPreviews ?? false;
  const hasReadReceipts = items['read-receipt-setting'] ?? false;
  const hasTypingIndicators = items.typingIndicators ?? false;
  const blockedCount =
    (items['blocked-groups']?.length ?? 0) +
    (items['blocked-uuids']?.length ?? 0);
  const emojiSkinToneDefault = items.emojiSkinToneDefault ?? EmojiSkinTone.None;
  const isInternalUser =
    items.remoteConfig?.['desktop.internalUser']?.enabled ?? false;
  const isContentProtectionSupported =
    Settings.isContentProtectionSupported(OS);
  const isContentProtectionNeeded = Settings.isContentProtectionNeeded(OS);

  const backupFeatureEnabled = isBackupFeatureEnabled(items.remoteConfig);
  const backupLocalBackupsEnabled = isLocalBackupsEnabled(items.remoteConfig);

  const donationsFeatureEnabled =
    (isInternalUser ||
      items.remoteConfig?.['desktop.donations']?.enabled ||
      (isProduction(window.getVersion()) &&
        items.remoteConfig?.['desktop.donations.prod']?.enabled)) ??
    false;

  // Two-way items

  function createItemsAccess<K extends keyof StorageAccessType>(
    key: K,
    defaultValue: StorageAccessType[K],
    callback?: (value: StorageAccessType[K]) => void
  ): [StorageAccessType[K], (value: StorageAccessType[K]) => void] {
    const value = items[key] ?? defaultValue;
    const setter = (newValue: StorageAccessType[K]) => {
      putItem(key, newValue);
      callback?.(newValue);
    };

    return [value, setter];
  }

  const [autoDownloadAttachment, onAutoDownloadAttachmentChange] =
    createItemsAccess(
      'auto-download-attachment',
      DEFAULT_AUTO_DOWNLOAD_ATTACHMENT
    );
  const [backupKeyViewed, onBackupKeyViewedChange] = createItemsAccess(
    'backupKeyViewed',
    false
  );

  const [hasAudioNotifications, onAudioNotificationsChange] = createItemsAccess(
    'audio-notification',
    false
  );
  const [hasAutoConvertEmoji, onAutoConvertEmojiChange] = createItemsAccess(
    'autoConvertEmoji',
    true
  );
  const [hasKeepMutedChatsArchived, onKeepMutedChatsArchivedChange] =
    createItemsAccess('keepMutedChatsArchived', false, () => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('keepMutedChatsArchived');
    });
  const [hasAutoDownloadUpdate, onAutoDownloadUpdateChange] = createItemsAccess(
    'auto-download-update',
    true
  );
  const [hasCallNotifications, onCallNotificationsChange] = createItemsAccess(
    'call-system-notification',
    true
  );
  const [hasIncomingCallNotifications, onIncomingCallNotificationsChange] =
    createItemsAccess('incoming-call-notification', true);
  const [hasCallRingtoneNotification, onCallRingtoneNotificationChange] =
    createItemsAccess('call-ringtone-notification', true);
  const [hasCountMutedConversations, onCountMutedConversationsChange] =
    createItemsAccess('badge-count-muted-conversations', false, () => {
      window.Whisper.events.emit('updateUnreadCount');
    });
  const [hasHideMenuBar, onHideMenuBarChange] = createItemsAccess(
    'hide-menu-bar',
    false,
    value => {
      window.IPC.setAutoHideMenuBar(value);
      window.IPC.setMenuBarVisibility(!value);
    }
  );
  const [hasMessageAudio, onMessageAudioChange] = createItemsAccess(
    'audioMessage',
    false
  );
  const [hasNotificationAttention, onNotificationAttentionChange] =
    createItemsAccess('notification-draw-attention', false);

  const [notificationContent, onNotificationContentChange] = createItemsAccess(
    'notification-setting',
    'message'
  );
  const hasNotifications = notificationContent !== 'off';
  const onNotificationsChange = (value: boolean) => {
    putItem(
      'notification-setting',
      value ? DEFAULT_NOTIFICATION_SETTING : 'off'
    );
  };

  const [hasRelayCalls, onRelayCallsChange] = createItemsAccess(
    'always-relay-calls',
    false
  );
  const [hasStoriesDisabled, onHasStoriesDisabledChanged] = createItemsAccess(
    'hasStoriesDisabled',
    false,
    async value => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('hasStoriesDisabled');
      window.textsecure.server?.onHasStoriesDisabledChange(value);
      if (!value) {
        await deleteAllMyStories();
      }
    }
  );
  const [hasTextFormatting, onTextFormattingChange] = createItemsAccess(
    'textFormatting',
    true
  );
  const [lastSyncTime, onLastSyncTimeChange] = createItemsAccess(
    'synced_at',
    undefined
  );

  const [selectedCamera, onSelectedCameraChange] = createItemsAccess(
    'preferred-video-input-device',
    undefined
  );
  const [selectedMicrophone, onSelectedMicrophoneChange] = createItemsAccess(
    'preferred-audio-input-device',
    undefined
  );
  const [selectedSpeaker, onSelectedSpeakerChange] = createItemsAccess(
    'preferred-audio-output-device',
    undefined
  );

  const [sentMediaQualitySetting, onSentMediaQualityChange] = createItemsAccess(
    'sent-media-quality',
    'standard'
  );

  const [whoCanFindMe, onWhoCanFindMeChange] = createItemsAccess(
    'phoneNumberDiscoverability',
    PhoneNumberDiscoverability.NotDiscoverable,
    async (newValue: PhoneNumberDiscoverability) => {
      strictAssert(window.textsecure.server, 'WebAPI must be available');
      await window.textsecure.server.setPhoneNumberDiscoverability(
        newValue === PhoneNumberDiscoverability.Discoverable
      );
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('phoneNumberDiscoverability');
    }
  );

  const [whoCanSeeMe, onWhoCanSeeMeChange] = createItemsAccess(
    'phoneNumberSharingMode',
    PhoneNumberSharingMode.Nobody,
    async (newValue: PhoneNumberSharingMode) => {
      const account = window.ConversationController.getOurConversationOrThrow();

      if (newValue === PhoneNumberSharingMode.Everybody) {
        onWhoCanFindMeChange(PhoneNumberDiscoverability.Discoverable);
      }
      account.captureChange('phoneNumberSharingMode');

      // Write profile after updating storage so that the write has up-to-date
      // information.
      await writeProfile(getConversation(account), {
        keepAvatar: true,
      });
    }
  );

  const __dangerouslyRunAbitraryReadOnlySqlQuery = useCallback(
    (readOnlySqlQuery: string) => {
      return DataReader.__dangerouslyRunAbitraryReadOnlySqlQuery(
        readOnlySqlQuery
      );
    },
    []
  );

  if (currentLocation.tab !== NavTab.Settings) {
    return null;
  }

  const { page } = currentLocation.details;
  const setPage = (newPage: SettingsPage, editState?: ProfileEditorPage) => {
    if (newPage === SettingsPage.Profile) {
      changeLocation({
        tab: NavTab.Settings,
        details: {
          page: newPage,
          state: editState || ProfileEditorPage.None,
        },
      });
      return;
    }

    changeLocation({
      tab: NavTab.Settings,
      details: {
        page: newPage,
      },
    });
  };

  const accountEntropyPool = window.storage.get('accountEntropyPool');

  return (
    <StrictMode>
      <AxoProvider dir={i18n.getLocaleDirection()}>
        <Preferences
          accountEntropyPool={accountEntropyPool}
          addCustomColor={addCustomColor}
          autoDownloadAttachment={autoDownloadAttachment}
          availableCameras={availableCameras}
          availableLocales={availableLocales}
          availableMicrophones={availableMicrophones}
          availableSpeakers={availableSpeakers}
          backupFeatureEnabled={backupFeatureEnabled}
          backupKeyViewed={backupKeyViewed}
          backupSubscriptionStatus={
            backupSubscriptionStatus ?? { status: 'off' }
          }
          backupMediaDownloadStatus={{
            completedBytes: backupMediaDownloadCompletedBytes ?? 0,
            totalBytes: backupMediaDownloadTotalBytes ?? 0,
            isPaused: Boolean(backupMediaDownloadPaused),
            isIdle: Boolean(attachmentDownloadManagerIdled),
          }}
          backupLocalBackupsEnabled={backupLocalBackupsEnabled}
          badge={badge}
          blockedCount={blockedCount}
          cloudBackupStatus={cloudBackupStatus}
          customColors={customColors}
          defaultConversationColor={defaultConversationColor}
          deviceName={deviceName}
          donationsFeatureEnabled={donationsFeatureEnabled}
          emojiSkinToneDefault={emojiSkinToneDefault}
          exportLocalBackup={exportLocalBackup}
          phoneNumber={phoneNumber}
          doDeleteAllData={doDeleteAllData}
          editCustomColor={editCustomColor}
          getConversationsWithCustomColor={getConversationsWithCustomColor}
          getMessageCountBySchemaVersion={
            DataReader.getMessageCountBySchemaVersion
          }
          getMessageSampleForSchemaVersion={
            DataReader.getMessageSampleForSchemaVersion
          }
          hasAudioNotifications={hasAudioNotifications}
          hasAutoConvertEmoji={hasAutoConvertEmoji}
          hasAutoDownloadUpdate={hasAutoDownloadUpdate}
          hasAutoLaunch={hasAutoLaunch}
          hasKeepMutedChatsArchived={hasKeepMutedChatsArchived}
          hasCallNotifications={hasCallNotifications}
          hasCallRingtoneNotification={hasCallRingtoneNotification}
          hasContentProtection={hasContentProtection}
          hasCountMutedConversations={hasCountMutedConversations}
          hasFailedStorySends={hasFailedStorySends}
          hasHideMenuBar={hasHideMenuBar}
          hasIncomingCallNotifications={hasIncomingCallNotifications}
          hasLinkPreviews={hasLinkPreviews}
          hasMediaCameraPermissions={hasMediaCameraPermissions}
          hasMediaPermissions={hasMediaPermissions}
          hasMessageAudio={hasMessageAudio}
          hasMinimizeToAndStartInSystemTray={hasMinimizeToAndStartInSystemTray}
          hasMinimizeToSystemTray={hasMinimizeToSystemTray}
          hasNotificationAttention={hasNotificationAttention}
          hasNotifications={hasNotifications}
          hasReadReceipts={hasReadReceipts}
          hasRelayCalls={hasRelayCalls}
          hasSpellCheck={hasSpellCheck}
          hasStoriesDisabled={hasStoriesDisabled}
          hasTextFormatting={hasTextFormatting}
          hasTypingIndicators={hasTypingIndicators}
          i18n={i18n}
          initialSpellCheckSetting={initialSpellCheckSetting}
          isAutoDownloadUpdatesSupported={isAutoDownloadUpdatesSupported}
          isAutoLaunchSupported={isAutoLaunchSupported}
          isContentProtectionNeeded={isContentProtectionNeeded}
          isContentProtectionSupported={isContentProtectionSupported}
          isHideMenuBarSupported={isHideMenuBarSupported}
          isMinimizeToAndStartInSystemTraySupported={
            isMinimizeToAndStartInSystemTraySupported
          }
          isNotificationAttentionSupported={isNotificationAttentionSupported}
          isSyncSupported={isSyncSupported}
          isSystemTraySupported={isSystemTraySupported}
          isInternalUser={isInternalUser}
          lastSyncTime={lastSyncTime}
          localBackupFolder={localBackupFolder}
          localeOverride={localeOverride}
          makeSyncRequest={makeSyncRequest}
          me={me}
          navTabsCollapsed={navTabsCollapsed}
          notificationContent={notificationContent}
          onAudioNotificationsChange={onAudioNotificationsChange}
          onAutoConvertEmojiChange={onAutoConvertEmojiChange}
          onAutoDownloadAttachmentChange={onAutoDownloadAttachmentChange}
          onAutoDownloadUpdateChange={onAutoDownloadUpdateChange}
          onAutoLaunchChange={onAutoLaunchChange}
          onBackupKeyViewedChange={onBackupKeyViewedChange}
          onCallNotificationsChange={onCallNotificationsChange}
          onCallRingtoneNotificationChange={onCallRingtoneNotificationChange}
          onContentProtectionChange={onContentProtectionChange}
          onCountMutedConversationsChange={onCountMutedConversationsChange}
          onEmojiSkinToneDefaultChange={onEmojiSkinToneDefaultChange}
          onHasStoriesDisabledChanged={onHasStoriesDisabledChanged}
          onHideMenuBarChange={onHideMenuBarChange}
          onIncomingCallNotificationsChange={onIncomingCallNotificationsChange}
          onKeepMutedChatsArchivedChange={onKeepMutedChatsArchivedChange}
          onLastSyncTimeChange={onLastSyncTimeChange}
          onLocaleChange={onLocaleChange}
          onMediaCameraPermissionsChange={onMediaCameraPermissionsChange}
          onMediaPermissionsChange={onMediaPermissionsChange}
          onMessageAudioChange={onMessageAudioChange}
          onMinimizeToAndStartInSystemTrayChange={
            onMinimizeToAndStartInSystemTrayChange
          }
          onMinimizeToSystemTrayChange={onMinimizeToSystemTrayChange}
          onNotificationAttentionChange={onNotificationAttentionChange}
          onNotificationContentChange={onNotificationContentChange}
          onNotificationsChange={onNotificationsChange}
          onStartUpdate={startUpdate}
          onRelayCallsChange={onRelayCallsChange}
          onSelectedCameraChange={onSelectedCameraChange}
          onSelectedMicrophoneChange={onSelectedMicrophoneChange}
          onSelectedSpeakerChange={onSelectedSpeakerChange}
          onSentMediaQualityChange={onSentMediaQualityChange}
          onSpellCheckChange={onSpellCheckChange}
          onTextFormattingChange={onTextFormattingChange}
          onThemeChange={onThemeChange}
          onToggleNavTabsCollapse={toggleNavTabsCollapse}
          onUniversalExpireTimerChange={onUniversalExpireTimerChange}
          onWhoCanFindMeChange={onWhoCanFindMeChange}
          onWhoCanSeeMeChange={onWhoCanSeeMeChange}
          onZoomFactorChange={onZoomFactorChange}
          otherTabsUnreadStats={otherTabsUnreadStats}
          page={page}
          pickLocalBackupFolder={pickLocalBackupFolder}
          preferredSystemLocales={preferredSystemLocales}
          preferredWidthFromStorage={preferredWidthFromStorage}
          refreshCloudBackupStatus={refreshCloudBackupStatus}
          refreshBackupSubscriptionStatus={refreshBackupSubscriptionStatus}
          removeCustomColorOnConversations={removeCustomColorOnConversations}
          removeCustomColor={removeCustomColor}
          renderDonationsPane={renderDonationsPane}
          renderProfileEditor={renderProfileEditor}
          renderToastManager={renderToastManager}
          renderUpdateDialog={renderUpdateDialog}
          renderPreferencesChatFoldersPage={renderPreferencesChatFoldersPage}
          renderPreferencesEditChatFolderPage={
            renderPreferencesEditChatFolderPage
          }
          promptOSAuth={promptOSAuth}
          resetAllChatColors={resetAllChatColors}
          resetDefaultChatColor={resetDefaultChatColor}
          resolvedLocale={resolvedLocale}
          savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
          resumeBackupMediaDownload={resumeBackupMediaDownload}
          pauseBackupMediaDownload={pauseBackupMediaDownload}
          cancelBackupMediaDownload={cancelBackupMediaDownload}
          selectedCamera={selectedCamera}
          selectedMicrophone={selectedMicrophone}
          selectedSpeaker={selectedSpeaker}
          sentMediaQualitySetting={sentMediaQualitySetting}
          setGlobalDefaultConversationColor={setGlobalDefaultConversationColor}
          setPage={setPage}
          shouldShowUpdateDialog={shouldShowUpdateDialog}
          showToast={showToast}
          theme={theme}
          themeSetting={themeSetting}
          universalExpireTimer={universalExpireTimer}
          validateBackup={validateBackup}
          whoCanFindMe={whoCanFindMe}
          whoCanSeeMe={whoCanSeeMe}
          zoomFactor={zoomFactor}
          donationReceipts={donationReceipts}
          internalAddDonationReceipt={internalAddDonationReceipt}
          saveAttachmentToDisk={window.Signal.Migrations.saveAttachmentToDisk}
          generateDonationReceiptBlob={generateDonationReceiptBlob}
          __dangerouslyRunAbitraryReadOnlySqlQuery={
            __dangerouslyRunAbitraryReadOnlySqlQuery
          }
        />
      </AxoProvider>
    </StrictMode>
  );
}
