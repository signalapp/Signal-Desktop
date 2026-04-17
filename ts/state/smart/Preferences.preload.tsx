// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode, useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

import type { AudioDevice } from '@signalapp/ringrtc';
import type { MutableRefObject } from 'react';

import { useItemsActions } from '../ducks/items.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import {
  getConversationsWithCustomColorSelector,
  getMe,
  getOtherTabsUnreadStats,
} from '../selectors/conversations.dom.ts';
import {
  getBackupKey,
  getCustomColors,
  getItems,
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
} from '../selectors/items.dom.ts';
import {
  itemStorage,
  DEFAULT_AUTO_DOWNLOAD_ATTACHMENT,
} from '../../textsecure/Storage.preload.ts';
import {
  onHasStoriesDisabledChange,
  setPhoneNumberDiscoverability,
} from '../../textsecure/WebAPI.preload.ts';
import { DEFAULT_CONVERSATION_COLOR } from '../../types/Colors.std.ts';
import { saveAttachmentToDisk } from '../../util/migrations.preload.ts';
import { format } from '../../types/PhoneNumber.std.ts';
import {
  areWePrimaryDevice,
  getIntl,
  getTheme,
  getUser,
  getUserNumber,
} from '../selectors/user.std.ts';
import { EmojiSkinTone } from '../../components/fun/data/emojis.std.ts';
import { renderClearingDataView } from '../../shims/renderClearingDataView.preload.tsx';
import OS from '../../util/os/osPreload.preload.ts';
import { themeChanged } from '../../shims/themeChanged.dom.ts';
import * as Settings from '../../types/Settings.std.ts';
import * as universalExpireTimerUtil from '../../util/universalExpireTimer.preload.ts';
import {
  parseSystemTraySetting,
  shouldMinimizeToSystemTray,
  SystemTraySetting,
} from '../../types/SystemTraySetting.std.ts';
import { calling } from '../../services/calling.preload.ts';
import { drop } from '../../util/drop.std.ts';
import { assertDev } from '../../util/assert.std.ts';
import { backupsService } from '../../services/backups/index.preload.ts';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.ts';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability.std.ts';
import { PhoneNumberSharingMode } from '../../types/PhoneNumberSharingMode.std.ts';
import { writeProfile } from '../../services/writeProfile.preload.ts';
import { keyTransparency } from '../../services/keyTransparency.preload.ts';
import { getConversation } from '../../util/getConversation.preload.ts';
import { waitForEvent } from '../../shims/events.dom.ts';
import { DAY } from '../../util/durations/index.std.ts';
import { sendSyncRequests } from '../../textsecure/syncRequests.preload.ts';
import { SmartUpdateDialog } from './UpdateDialog.preload.tsx';
import { Preferences } from '../../components/Preferences.dom.tsx';
import { useUpdatesActions } from '../ducks/updates.preload.ts';
import { getUpdateDialogType } from '../selectors/updates.std.ts';
import { getHasAnyFailedStorySends } from '../selectors/stories.preload.ts';
import {
  getSelectedConversationId,
  getSelectedLocation,
} from '../selectors/nav.std.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { SmartProfileEditor } from './ProfileEditor.preload.tsx';
import { useNavActions } from '../ducks/nav.std.ts';
import { NavTab } from '../../types/Nav.std.ts';
import { renderToastManagerWithoutMegaphone } from './ToastManager.preload.tsx';
import { useToastActions } from '../ducks/toast.preload.ts';
import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import { deleteAllMyStories } from '../../util/deleteAllMyStories.preload.ts';
import { SmartPreferencesDonations } from './PreferencesDonations.preload.tsx';
import { useDonationsActions } from '../ducks/donations.preload.ts';
import { generateDonationReceiptBlob } from '../../util/generateDonationReceipt.dom.ts';
import { getProfiles } from '../selectors/notificationProfiles.dom.ts';
import { backupLevelFromNumber } from '../../services/backups/types.std.ts';
import { getMessageQueueTime } from '../../util/getMessageQueueTime.dom.ts';
import { useBackupActions } from '../ducks/backups.preload.ts';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.ts';
import { SmartPreferencesChatFoldersPage } from './PreferencesChatFoldersPage.preload.tsx';
import { SmartPreferencesEditChatFolderPage } from './PreferencesEditChatFolderPage.preload.tsx';
import { AxoProvider } from '../../axo/AxoProvider.dom.tsx';
import {
  getCurrentChatFoldersCount,
  getHasAnyCurrentCustomChatFolders,
} from '../selectors/chatFolders.std.ts';
import {
  SmartNotificationProfilesCreateFlow,
  SmartNotificationProfilesHome,
} from './PreferencesNotificationProfiles.preload.tsx';

import type { SettingsLocation } from '../../types/Nav.std.ts';
import type { StorageAccessType } from '../../types/Storage.d.ts';
import type { ThemeType } from '../../util/preload.preload.ts';
import type { WidthBreakpoint } from '../../components/_util.std.ts';
import { DialogType } from '../../types/Dialogs.std.ts';
import { promptOSAuth } from '../../util/promptOSAuth.preload.ts';
import type { StateType } from '../reducer.preload.ts';
import {
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
  cancelBackupMediaDownload,
} from '../../util/backupMediaDownload.preload.ts';
import { DonationsErrorBoundary } from '../../components/DonationsErrorBoundary.dom.tsx';
import type { SmartPreferencesChatFoldersPageProps } from './PreferencesChatFoldersPage.preload.tsx';
import type { SmartPreferencesEditChatFolderPageProps } from './PreferencesEditChatFolderPage.preload.tsx';
import type { ExternalProps as SmartNotificationProfilesProps } from './PreferencesNotificationProfiles.preload.tsx';
import { useMegaphonesActions } from '../ducks/megaphones.preload.ts';
import type { ZoomFactorType } from '../../types/StorageKeys.std.ts';
import { isLocalBackupsEnabled } from '../../util/isLocalBackupsEnabled.preload.ts';
import { getBackupKeyHash } from '../../services/backups/crypto.preload.ts';

const DEFAULT_NOTIFICATION_SETTING = 'message';

function renderUpdateDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): React.JSX.Element {
  return <SmartUpdateDialog {...props} disableDismiss />;
}

function renderPreferencesChatFoldersPage(
  props: SmartPreferencesChatFoldersPageProps
): React.JSX.Element {
  return <SmartPreferencesChatFoldersPage {...props} />;
}

function renderPreferencesEditChatFolderPage(
  props: SmartPreferencesEditChatFolderPageProps
): React.JSX.Element {
  return <SmartPreferencesEditChatFolderPage {...props} />;
}

function renderNotificationProfilesHome(
  props: SmartNotificationProfilesProps
): React.JSX.Element {
  return <SmartNotificationProfilesHome {...props} />;
}

function renderNotificationProfilesCreateFlow(
  props: SmartNotificationProfilesProps
): React.JSX.Element {
  return <SmartNotificationProfilesCreateFlow {...props} />;
}

function renderProfileEditor(options: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
}): React.JSX.Element {
  return <SmartProfileEditor contentsRef={options.contentsRef} />;
}

function renderDonationsPane({
  contentsRef,
  settingsLocation,
  setSettingsLocation,
}: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  settingsLocation: SettingsLocation;
  setSettingsLocation: (settingsLocation: SettingsLocation) => void;
}): React.JSX.Element {
  return (
    <DonationsErrorBoundary>
      <SmartPreferencesDonations
        contentsRef={contentsRef}
        settingsLocation={settingsLocation}
        setSettingsLocation={setSettingsLocation}
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

async function forceKeyTransparencyCheck(): Promise<void> {
  await keyTransparency.selfCheck();
}

export function SmartPreferences(): React.JSX.Element | null {
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
  const { showToast, openFileInFolder } = useToastActions();
  const { internalAddDonationReceipt } = useDonationsActions();
  const { startPlaintextExport, startLocalBackupExport } = useBackupActions();
  const { addVisibleMegaphone } = useMegaphonesActions();

  // Selectors

  const currentLocation = useSelector(getSelectedLocation);
  const customColors = useSelector(getCustomColors) ?? {};
  const getConversationsWithCustomColor = useSelector(
    getConversationsWithCustomColorSelector
  );
  const i18n = useSelector(getIntl);
  const dialogType = useSelector(getUpdateDialogType);
  const items = useSelector(getItems);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const me = useSelector(getMe);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const preferredWidthFromStorage = useSelector(getPreferredLeftPaneWidth);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const theme = useSelector(getTheme);
  const donationReceipts = useSelector(
    (state: StateType) => state.donations.receipts
  );
  const notificationProfileCount = useSelector(getProfiles).length;
  const weArePrimaryDevice = useSelector(areWePrimaryDevice);

  const shouldShowUpdateDialog = dialogType !== DialogType.None;
  const badge = getPreferredBadge(me.badges);
  const currentChatFoldersCount = useSelector(getCurrentChatFoldersCount);
  const hasAnyCurrentCustomChatFolders = useSelector(
    getHasAnyCurrentCustomChatFolders
  );
  const { osName } = useSelector(getUser);

  const backupKey = useSelector(getBackupKey);
  const backupKeyHash = useMemo(() => {
    if (!backupKey) {
      return undefined;
    }
    return getBackupKeyHash(backupKey);
  }, [backupKey]);

  // The weird ones

  const makeSyncRequest = async () => {
    if (weArePrimaryDevice) {
      throw new Error(
        'Preferences/makeSyncRequest: We are primary device; no sync requests!'
      );
    }

    const contactSyncComplete = waitForEvent('contactSync:complete');
    return Promise.all([sendSyncRequests(), contactSyncComplete]);
  };

  const universalExpireTimer = universalExpireTimerUtil.getForRedux(items);
  const onUniversalExpireTimerChange = async (newValue: number) => {
    await universalExpireTimerUtil.set(DurationInSeconds.fromSeconds(newValue));

    // Update account in Storage Service
    const account = window.ConversationController.getOurConversationOrThrow();
    account.captureChange('universalExpireTimer');

    // Add a notification to the currently open conversation
    const selectedId = getSelectedConversationId(window.reduxStore.getState());
    if (selectedId) {
      const conversation = window.ConversationController.get(selectedId);
      assertDev(conversation, "Conversation wasn't found");

      await conversation.updateLastMessage();
    }
  };

  const validateBackup = () => backupsService._internalValidate();
  const pickLocalBackupFolder = () => backupsService.pickLocalBackupFolder();

  const doDeleteAllData = () => renderClearingDataView();
  const refreshCloudBackupStatus =
    backupsService.throttledFetchCloudBackupStatus;
  const refreshBackupSubscriptionStatus =
    backupsService.throttledFetchSubscriptionStatus;

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
  const isSyncSupported = !weArePrimaryDevice;

  const [deviceName, setDeviceName] = React.useState(
    itemStorage.user.getDeviceName()
  );
  useEffect(() => {
    let canceled = false;
    const onDeviceNameChanged = () => {
      const value = itemStorage.user.getDeviceName();
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

  const onBackupKeyViewed = (args: { backupKeyHash: string }) => {
    onBackupKeyViewedChange(args.backupKeyHash);
  };

  // Simple, one-way items

  const {
    backupSubscriptionStatus,
    backupTier,
    cloudBackupStatus,
    lastLocalBackup,
    localBackupFolder,
    backupMediaDownloadCompletedBytes,
    backupMediaDownloadTotalBytes,
    attachmentDownloadManagerIdled,
    backupMediaDownloadPaused,
  } = items;
  const defaultConversationColor =
    items.defaultConversationColor || DEFAULT_CONVERSATION_COLOR;

  const blockedCount =
    (items['blocked-groups']?.length ?? 0) +
    (items['blocked-uuids']?.length ?? 0);
  const emojiSkinToneDefault = items.emojiSkinToneDefault ?? EmojiSkinTone.None;
  const isInternalUser =
    items.remoteConfig?.['desktop.internalUser']?.enabled ?? false;
  const isContentProtectionSupported =
    Settings.isContentProtectionSupported(OS);
  const isContentProtectionNeeded = Settings.isContentProtectionNeeded(OS);

  const backupLocalBackupsEnabled = isLocalBackupsEnabled({
    currentVersion: version,
    remoteConfig: items.remoteConfig,
  });
  const backupFreeMediaDays = getMessageQueueTime(items.remoteConfig) / DAY;

  const isPlaintextExportEnabled = isFeaturedEnabledSelector({
    betaKey: 'desktop.plaintextExport.beta',
    currentVersion: version,
    remoteConfig: items.remoteConfig,
    prodKey: 'desktop.plaintextExport.prod',
  });

  const isKeyTransparencyAvailable = isFeaturedEnabledSelector({
    betaKey: 'desktop.keyTransparency.beta',
    prodKey: 'desktop.keyTransparency.prod',
    currentVersion: version,
    remoteConfig: items.remoteConfig,
  });

  // Two-way items

  function createItemsAccess<K extends keyof StorageAccessType>(
    key: K,
    defaultValue: StorageAccessType[K],
    callback?: (value: StorageAccessType[K]) => void
  ): [StorageAccessType[K], (value: StorageAccessType[K]) => void] {
    const value =
      (items[key] as StorageAccessType[K] | undefined) ?? defaultValue;
    const setter = (newValue: StorageAccessType[K]) => {
      putItem(key, newValue);
      callback?.(newValue);
    };

    return [value, setter];
  }

  const [hasLinkPreviews, onLinkPreviewsChange] = createItemsAccess(
    'linkPreviews',
    false,
    () => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('linkPreviews');
    }
  );
  const [hasPreferContactAvatars, onPreferContactAvatarsChange] =
    createItemsAccess('preferContactAvatars', false, () => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('preferContactAvatars');
      drop(window.ConversationController.rerenderAfterAvatarChange());
    });

  const [hasReadReceipts, onReadReceiptsChange] = createItemsAccess(
    'read-receipt-setting',
    false,
    () => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('read-receipt-setting');
    }
  );
  const [hasTypingIndicators, onTypingIndicatorsChange] = createItemsAccess(
    'typingIndicators',
    false,
    () => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('typingIndicators');
    }
  );
  const [hasSealedSenderIndicators, onSealedSenderIndicatorsChange] =
    createItemsAccess('sealedSenderIndicators', false, () => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('sealedSenderIndicators');
    });

  const [autoDownloadAttachment, onAutoDownloadAttachmentChange] =
    createItemsAccess(
      'auto-download-attachment',
      DEFAULT_AUTO_DOWNLOAD_ATTACHMENT
    );

  const [previouslyViewedBackupKeyHash, onBackupKeyViewedChange] =
    createItemsAccess('backupKeyViewedHash', undefined);

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
      onHasStoriesDisabledChange(value);
      if (!value) {
        await deleteAllMyStories();
      }
    }
  );
  const [hasKeyTransparencyDisabled, onHasKeyTransparencyDisabledChanged] =
    createItemsAccess('hasKeyTransparencyDisabled', false, async value => {
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('hasKeyTransparencyDisabled');
      if (value) {
        await keyTransparency.disable();
      }
    });
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
      await setPhoneNumberDiscoverability(
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

  const internalDeleteAllMegaphones = useCallback(() => {
    return DataWriter.internalDeleteAllMegaphones();
  }, []);

  const __dangerouslyRunAbitraryReadOnlySqlQuery = useCallback(
    (readOnlySqlQuery: string) => {
      return DataReader.__dangerouslyRunAbitraryReadOnlySqlQuery(
        readOnlySqlQuery
      );
    },
    []
  );

  const cqsTestMode = items.cqsTestMode ?? false;

  const setCqsTestMode = useCallback((value: boolean) => {
    drop(itemStorage.put('cqsTestMode', value));
  }, []);

  const setDredDuration = useCallback((value: number | undefined) => {
    drop(itemStorage.put('dredDuration', value));
  }, []);
  const setIsDirectVp9Enabled = useCallback((value: boolean | undefined) => {
    drop(itemStorage.put('isDirectVp9Enabled', value));
  }, []);
  const setDirectMaxBitrate = useCallback((value: number | undefined) => {
    drop(itemStorage.put('directMaxBitrate', value));
  }, []);
  const setIsGroupVp9Enabled = useCallback((value: boolean | undefined) => {
    drop(itemStorage.put('isGroupVp9Enabled', value));
  }, []);
  const setGroupMaxBitrate = useCallback((value: number | undefined) => {
    drop(itemStorage.put('groupMaxBitrate', value));
  }, []);
  const setSfuUrl = useCallback((value: string | undefined) => {
    drop(itemStorage.put('sfuUrl', value));
  }, []);

  if (currentLocation.tab !== NavTab.Settings) {
    return null;
  }

  const settingsLocation = currentLocation.details;

  const setSettingsLocation = (location: SettingsLocation) => {
    changeLocation({
      tab: NavTab.Settings,
      details: location,
    });
  };

  return (
    <StrictMode>
      <AxoProvider dir={i18n.getLocaleDirection()}>
        <Preferences
          backupKey={backupKey}
          backupKeyHash={backupKeyHash}
          addCustomColor={addCustomColor}
          autoDownloadAttachment={autoDownloadAttachment}
          availableCameras={availableCameras}
          availableLocales={availableLocales}
          availableMicrophones={availableMicrophones}
          availableSpeakers={availableSpeakers}
          backupTier={backupLevelFromNumber(backupTier)}
          backupSubscriptionStatus={
            backupSubscriptionStatus ?? { status: 'not-found' }
          }
          backupFreeMediaDays={backupFreeMediaDays}
          backupMediaDownloadStatus={{
            completedBytes: backupMediaDownloadCompletedBytes ?? 0,
            totalBytes: backupMediaDownloadTotalBytes ?? 0,
            isPaused: Boolean(backupMediaDownloadPaused),
            isIdle: Boolean(attachmentDownloadManagerIdled),
          }}
          backupLocalBackupsEnabled={backupLocalBackupsEnabled}
          badge={badge}
          blockedCount={blockedCount}
          currentChatFoldersCount={currentChatFoldersCount}
          cloudBackupStatus={cloudBackupStatus}
          customColors={customColors}
          defaultConversationColor={defaultConversationColor}
          deviceName={deviceName}
          disableLocalBackups={backupsService.disableLocalBackups}
          emojiSkinToneDefault={emojiSkinToneDefault}
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
          hasAnyCurrentCustomChatFolders={hasAnyCurrentCustomChatFolders}
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
          hasKeyTransparencyDisabled={hasKeyTransparencyDisabled}
          hasLinkPreviews={hasLinkPreviews}
          hasMediaCameraPermissions={hasMediaCameraPermissions}
          hasMediaPermissions={hasMediaPermissions}
          hasMessageAudio={hasMessageAudio}
          hasMinimizeToAndStartInSystemTray={hasMinimizeToAndStartInSystemTray}
          hasMinimizeToSystemTray={hasMinimizeToSystemTray}
          hasNotificationAttention={hasNotificationAttention}
          hasNotifications={hasNotifications}
          hasPreferContactAvatars={hasPreferContactAvatars}
          hasReadReceipts={hasReadReceipts}
          hasRelayCalls={hasRelayCalls}
          hasSealedSenderIndicators={hasSealedSenderIndicators}
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
          isKeyTransparencyAvailable={isKeyTransparencyAvailable}
          isMinimizeToAndStartInSystemTraySupported={
            isMinimizeToAndStartInSystemTraySupported
          }
          isNotificationAttentionSupported={isNotificationAttentionSupported}
          isPlaintextExportEnabled={isPlaintextExportEnabled}
          isSyncSupported={isSyncSupported}
          isSystemTraySupported={isSystemTraySupported}
          isInternalUser={isInternalUser}
          lastLocalBackup={lastLocalBackup}
          lastSyncTime={lastSyncTime}
          localBackupFolder={localBackupFolder}
          localeOverride={localeOverride}
          makeSyncRequest={makeSyncRequest}
          me={me}
          navTabsCollapsed={navTabsCollapsed}
          notificationContent={notificationContent}
          notificationProfileCount={notificationProfileCount}
          onAudioNotificationsChange={onAudioNotificationsChange}
          onAutoConvertEmojiChange={onAutoConvertEmojiChange}
          onAutoDownloadAttachmentChange={onAutoDownloadAttachmentChange}
          onAutoDownloadUpdateChange={onAutoDownloadUpdateChange}
          onAutoLaunchChange={onAutoLaunchChange}
          onBackupKeyViewed={onBackupKeyViewed}
          onCallNotificationsChange={onCallNotificationsChange}
          onCallRingtoneNotificationChange={onCallRingtoneNotificationChange}
          onContentProtectionChange={onContentProtectionChange}
          onCountMutedConversationsChange={onCountMutedConversationsChange}
          onEmojiSkinToneDefaultChange={onEmojiSkinToneDefaultChange}
          onHasKeyTransparencyDisabledChanged={
            onHasKeyTransparencyDisabledChanged
          }
          onHasStoriesDisabledChanged={onHasStoriesDisabledChanged}
          onHideMenuBarChange={onHideMenuBarChange}
          onIncomingCallNotificationsChange={onIncomingCallNotificationsChange}
          onKeepMutedChatsArchivedChange={onKeepMutedChatsArchivedChange}
          onLastSyncTimeChange={onLastSyncTimeChange}
          onLinkPreviewsChange={onLinkPreviewsChange}
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
          onPreferContactAvatarsChange={onPreferContactAvatarsChange}
          onReadReceiptsChange={onReadReceiptsChange}
          onRelayCallsChange={onRelayCallsChange}
          onSealedSenderIndicatorsChange={onSealedSenderIndicatorsChange}
          onSelectedCameraChange={onSelectedCameraChange}
          onSelectedMicrophoneChange={onSelectedMicrophoneChange}
          onSelectedSpeakerChange={onSelectedSpeakerChange}
          onSentMediaQualityChange={onSentMediaQualityChange}
          onSpellCheckChange={onSpellCheckChange}
          onTextFormattingChange={onTextFormattingChange}
          onThemeChange={onThemeChange}
          onToggleNavTabsCollapse={toggleNavTabsCollapse}
          onTypingIndicatorsChange={onTypingIndicatorsChange}
          onUniversalExpireTimerChange={onUniversalExpireTimerChange}
          onWhoCanFindMeChange={onWhoCanFindMeChange}
          onWhoCanSeeMeChange={onWhoCanSeeMeChange}
          onZoomFactorChange={onZoomFactorChange}
          openFileInFolder={openFileInFolder}
          osName={osName}
          otherTabsUnreadStats={otherTabsUnreadStats}
          settingsLocation={settingsLocation}
          pickLocalBackupFolder={pickLocalBackupFolder}
          preferredSystemLocales={preferredSystemLocales}
          preferredWidthFromStorage={preferredWidthFromStorage}
          refreshCloudBackupStatus={refreshCloudBackupStatus}
          refreshBackupSubscriptionStatus={refreshBackupSubscriptionStatus}
          removeCustomColorOnConversations={removeCustomColorOnConversations}
          removeCustomColor={removeCustomColor}
          renderDonationsPane={renderDonationsPane}
          renderNotificationProfilesHome={renderNotificationProfilesHome}
          renderNotificationProfilesCreateFlow={
            renderNotificationProfilesCreateFlow
          }
          renderProfileEditor={renderProfileEditor}
          renderToastManager={renderToastManagerWithoutMegaphone}
          renderUpdateDialog={renderUpdateDialog}
          renderPreferencesChatFoldersPage={renderPreferencesChatFoldersPage}
          renderPreferencesEditChatFolderPage={
            renderPreferencesEditChatFolderPage
          }
          previouslyViewedBackupKeyHash={previouslyViewedBackupKeyHash}
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
          setSettingsLocation={setSettingsLocation}
          shouldShowUpdateDialog={shouldShowUpdateDialog}
          showToast={showToast}
          startLocalBackupExport={startLocalBackupExport}
          startPlaintextExport={startPlaintextExport}
          theme={theme}
          themeSetting={themeSetting}
          universalExpireTimer={universalExpireTimer}
          validateBackup={validateBackup}
          whoCanFindMe={whoCanFindMe}
          whoCanSeeMe={whoCanSeeMe}
          zoomFactor={zoomFactor}
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
          dredDuration={items.dredDuration}
          setDredDuration={setDredDuration}
          setIsDirectVp9Enabled={setIsDirectVp9Enabled}
          isDirectVp9Enabled={items.isDirectVp9Enabled}
          setDirectMaxBitrate={setDirectMaxBitrate}
          directMaxBitrate={items.directMaxBitrate}
          setIsGroupVp9Enabled={setIsGroupVp9Enabled}
          isGroupVp9Enabled={items.isGroupVp9Enabled}
          setGroupMaxBitrate={setGroupMaxBitrate}
          groupMaxBitrate={items.groupMaxBitrate}
          sfuUrl={items.sfuUrl}
          setSfuUrl={setSfuUrl}
          forceKeyTransparencyCheck={forceKeyTransparencyCheck}
          keyTransparencySelfHealth={items.keyTransparencySelfHealth}
        />
      </AxoProvider>
    </StrictMode>
  );
}
