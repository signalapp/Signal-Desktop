// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode, useEffect } from 'react';
import { useSelector } from 'react-redux';

import type { AudioDevice } from '@signalapp/ringrtc';
import type { MutableRefObject } from 'react';

import { useItemsActions } from '../ducks/items';
import { useConversationsActions } from '../ducks/conversations';
import {
  getAllComposableConversations,
  getConversationSelector,
  getConversationsWithCustomColorSelector,
  getMe,
} from '../selectors/conversations';
import {
  getCustomColors,
  getItems,
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
} from '../selectors/items';
import { DEFAULT_AUTO_DOWNLOAD_ATTACHMENT } from '../../textsecure/Storage';
import { DEFAULT_CONVERSATION_COLOR } from '../../types/Colors';
import { isBackupFeatureEnabledForRedux } from '../../util/isBackupEnabled';
import { format } from '../../types/PhoneNumber';
import {
  getIntl,
  getTheme,
  getUserDeviceId,
  getUserNumber,
} from '../selectors/user';
import { EmojiSkinTone } from '../../components/fun/data/emojis';
import { renderClearingDataView } from '../../shims/renderClearingDataView';
import OS from '../../util/os/osPreload';
import { themeChanged } from '../../shims/themeChanged';
import * as Settings from '../../types/Settings';
import * as universalExpireTimerUtil from '../../util/universalExpireTimer';
import {
  parseSystemTraySetting,
  shouldMinimizeToSystemTray,
  SystemTraySetting,
} from '../../types/SystemTraySetting';
import { calling } from '../../services/calling';
import { drop } from '../../util/drop';
import { assertDev, strictAssert } from '../../util/assert';
import { backupsService } from '../../services/backups';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from '../../util/phoneNumberSharingMode';
import { writeProfile } from '../../services/writeProfile';
import { getConversation } from '../../util/getConversation';
import { waitForEvent } from '../../shims/events';
import { MINUTE } from '../../util/durations';
import { sendSyncRequests } from '../../textsecure/syncRequests';
import { SmartUpdateDialog } from './UpdateDialog';
import { Page, Preferences } from '../../components/Preferences';
import { useUpdatesActions } from '../ducks/updates';
import { getUpdateDialogType } from '../selectors/updates';
import { getHasAnyFailedStorySends } from '../selectors/stories';
import { getOtherTabsUnreadStats, getSelectedLocation } from '../selectors/nav';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { SmartProfileEditor } from './ProfileEditor';
import { NavTab, useNavActions } from '../ducks/nav';
import { EditState } from '../../components/ProfileEditor';
import { SmartToastManager } from './ToastManager';
import { useToastActions } from '../ducks/toast';
import { DataReader } from '../../sql/Client';
import { deleteAllMyStories } from '../../util/deleteAllMyStories';
import { isLocalBackupsEnabledForRedux } from '../../util/isLocalBackupsEnabled';
import { SmartPreferencesDonations } from './PreferencesDonations';

import type { StorageAccessType, ZoomFactorType } from '../../types/Storage';
import type { ThemeType } from '../../util/preload';
import type { WidthBreakpoint } from '../../components/_util';
import { DialogType } from '../../types/Dialogs';
import { promptOSAuth } from '../../util/promptOSAuth';

const DEFAULT_NOTIFICATION_SETTING = 'message';

function renderUpdateDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartUpdateDialog {...props} disableDismiss />;
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

function renderDonationsPane(options: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
}): JSX.Element {
  return <SmartPreferencesDonations contentsRef={options.contentsRef} />;
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

  // Selectors

  const currentLocation = useSelector(getSelectedLocation);
  const customColors = useSelector(getCustomColors) ?? {};
  const getConversationsWithCustomColor = useSelector(
    getConversationsWithCustomColorSelector
  );
  const i18n = useSelector(getIntl);
  const conversations = useSelector(getAllComposableConversations);
  const conversationSelector = useSelector(getConversationSelector);
  const items = useSelector(getItems);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const dialogType = useSelector(getUpdateDialogType);
  const me = useSelector(getMe);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const preferredWidthFromStorage = useSelector(getPreferredLeftPaneWidth);
  const theme = useSelector(getTheme);

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
    await universalExpireTimerUtil.set(DurationInSeconds.fromMillis(newValue));

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

  const { backupSubscriptionStatus, cloudBackupStatus, localBackupFolder } =
    items;
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

  const backupFeatureEnabled = isBackupFeatureEnabledForRedux(
    items.remoteConfig
  );
  const backupLocalBackupsEnabled = isLocalBackupsEnabledForRedux(
    items.remoteConfig
  );
  const donationsFeatureEnabled =
    items.remoteConfig?.['desktop.internalUser']?.enabled ??
    items.remoteConfig?.['desktop.donations']?.enabled ??
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
      window.Whisper.events.trigger('updateUnreadCount');
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

  if (currentLocation.tab !== NavTab.Settings) {
    return null;
  }

  const { page } = currentLocation.details;
  const setPage = (newPage: Page, editState?: EditState) => {
    if (newPage === Page.Profile) {
      changeLocation({
        tab: NavTab.Settings,
        details: {
          page: newPage,
          state: editState || EditState.None,
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
      <Preferences
        conversations={conversations}
        conversationSelector={conversationSelector}
        accountEntropyPool={accountEntropyPool}
        addCustomColor={addCustomColor}
        autoDownloadAttachment={autoDownloadAttachment}
        availableCameras={availableCameras}
        availableLocales={availableLocales}
        availableMicrophones={availableMicrophones}
        availableSpeakers={availableSpeakers}
        backupFeatureEnabled={backupFeatureEnabled}
        backupKeyViewed={backupKeyViewed}
        backupSubscriptionStatus={backupSubscriptionStatus ?? { status: 'off' }}
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
        getPreferredBadge={getPreferredBadge}
        hasAudioNotifications={hasAudioNotifications}
        hasAutoConvertEmoji={hasAutoConvertEmoji}
        hasAutoDownloadUpdate={hasAutoDownloadUpdate}
        hasAutoLaunch={hasAutoLaunch}
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
        promptOSAuth={promptOSAuth}
        resetAllChatColors={resetAllChatColors}
        resetDefaultChatColor={resetDefaultChatColor}
        resolvedLocale={resolvedLocale}
        savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
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
      />
    </StrictMode>
  );
}
