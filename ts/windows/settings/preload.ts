// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This has to be the first import because of monkey-patching
import '../shims';

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge, ipcRenderer } from 'electron';

import { SignalContext } from '../context';
import * as Settings from '../../types/Settings';
import { Preferences } from '../../components/Preferences';
import {
  SystemTraySetting,
  parseSystemTraySetting,
  shouldMinimizeToSystemTray,
} from '../../types/SystemTraySetting';
import { awaitObject } from '../../util/awaitObject';
import { createSetting, createCallback } from '../../util/preload';
import { startInteractionMode } from '../startInteractionMode';

function doneRendering() {
  ipcRenderer.send('settings-done-rendering');
}

const settingAudioNotification = createSetting('audioNotification');
const settingAutoDownloadUpdate = createSetting('autoDownloadUpdate');
const settingAutoLaunch = createSetting('autoLaunch');
const settingCallRingtoneNotification = createSetting(
  'callRingtoneNotification'
);
const settingCallSystemNotification = createSetting('callSystemNotification');
const settingCountMutedConversations = createSetting('countMutedConversations');
const settingDeviceName = createSetting('deviceName', { setter: false });
const settingHideMenuBar = createSetting('hideMenuBar');
const settingIncomingCallNotification = createSetting(
  'incomingCallNotification'
);
const settingMediaCameraPermissions = createSetting('mediaCameraPermissions');
const settingMediaPermissions = createSetting('mediaPermissions');
const settingNotificationDrawAttention = createSetting(
  'notificationDrawAttention'
);
const settingNotificationSetting = createSetting('notificationSetting');
const settingRelayCalls = createSetting('alwaysRelayCalls');
const settingSpellCheck = createSetting('spellCheck');
const settingTheme = createSetting('themeSetting');
const settingSystemTraySetting = createSetting('systemTraySetting');

const settingLastSyncTime = createSetting('lastSyncTime');

const settingHasStoriesEnabled = createSetting('hasStoriesEnabled');
const settingZoomFactor = createSetting('zoomFactor');

// Getters only.
const settingBlockedCount = createSetting('blockedCount');
const settingLinkPreview = createSetting('linkPreviewSetting', {
  setter: false,
});
const settingPhoneNumberDiscoverability = createSetting(
  'phoneNumberDiscoverabilitySetting',
  { setter: false }
);
const settingPhoneNumberSharing = createSetting('phoneNumberSharingSetting', {
  setter: false,
});
const settingReadReceipts = createSetting('readReceiptSetting', {
  setter: false,
});
const settingTypingIndicators = createSetting('typingIndicatorSetting', {
  setter: false,
});

// Media settings
const settingAudioInput = createSetting('preferredAudioInputDevice');
const settingAudioOutput = createSetting('preferredAudioOutputDevice');
const settingVideoInput = createSetting('preferredVideoInputDevice');

const settingUniversalExpireTimer = createSetting('universalExpireTimer');

// Callbacks
const ipcGetAvailableIODevices = createCallback('getAvailableIODevices');
const ipcGetCustomColors = createCallback('getCustomColors');
const ipcIsSyncNotSupported = createCallback('isPrimary');
const ipcMakeSyncRequest = createCallback('syncRequest');
const ipcPNP = createCallback('isPhoneNumberSharingEnabled');
const ipcShouldShowStoriesSettings = createCallback(
  'shouldShowStoriesSettings'
);

// ChatColorPicker redux hookups
// The redux actions update over IPC through a preferences re-render
const ipcGetDefaultConversationColor = createCallback(
  'getDefaultConversationColor'
);
const ipcGetConversationsWithCustomColor = createCallback(
  'getConversationsWithCustomColor'
);
const ipcAddCustomColor = createCallback('addCustomColor');
const ipcEditCustomColor = createCallback('editCustomColor');
const ipcRemoveCustomColor = createCallback('removeCustomColor');
const ipcRemoveCustomColorOnConversations = createCallback(
  'removeCustomColorOnConversations'
);
const ipcResetAllChatColors = createCallback('resetAllChatColors');
const ipcResetDefaultChatColor = createCallback('resetDefaultChatColor');
const ipcSetGlobalDefaultConversationColor = createCallback(
  'setGlobalDefaultConversationColor'
);

const DEFAULT_NOTIFICATION_SETTING = 'message';

function getSystemTraySettingValues(systemTraySetting: SystemTraySetting): {
  hasMinimizeToAndStartInSystemTray: boolean;
  hasMinimizeToSystemTray: boolean;
} {
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

const renderPreferences = async () => {
  startInteractionMode();

  const {
    blockedCount,
    deviceName,
    hasAudioNotifications,
    hasAutoDownloadUpdate,
    hasAutoLaunch,
    hasCallNotifications,
    hasCallRingtoneNotification,
    hasCountMutedConversations,
    hasHideMenuBar,
    hasIncomingCallNotifications,
    hasLinkPreviews,
    hasMediaCameraPermissions,
    hasMediaPermissions,
    hasNotificationAttention,
    hasReadReceipts,
    hasRelayCalls,
    hasSpellCheck,
    hasStoriesEnabled,
    hasTypingIndicators,
    isPhoneNumberSharingSupported,
    lastSyncTime,
    notificationContent,
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
    systemTraySetting,
    themeSetting,
    universalExpireTimer,
    whoCanFindMe,
    whoCanSeeMe,
    zoomFactor,

    availableIODevices,
    customColors,
    defaultConversationColor,
    isSyncNotSupported,
    shouldShowStoriesSettings,
  } = await awaitObject({
    blockedCount: settingBlockedCount.getValue(),
    deviceName: settingDeviceName.getValue(),
    hasAudioNotifications: settingAudioNotification.getValue(),
    hasAutoDownloadUpdate: settingAutoDownloadUpdate.getValue(),
    hasAutoLaunch: settingAutoLaunch.getValue(),
    hasCallNotifications: settingCallSystemNotification.getValue(),
    hasCallRingtoneNotification: settingCallRingtoneNotification.getValue(),
    hasCountMutedConversations: settingCountMutedConversations.getValue(),
    hasHideMenuBar: settingHideMenuBar.getValue(),
    hasIncomingCallNotifications: settingIncomingCallNotification.getValue(),
    hasLinkPreviews: settingLinkPreview.getValue(),
    hasMediaCameraPermissions: settingMediaCameraPermissions.getValue(),
    hasMediaPermissions: settingMediaPermissions.getValue(),
    hasNotificationAttention: settingNotificationDrawAttention.getValue(),
    hasReadReceipts: settingReadReceipts.getValue(),
    hasRelayCalls: settingRelayCalls.getValue(),
    hasSpellCheck: settingSpellCheck.getValue(),
    hasStoriesEnabled: settingHasStoriesEnabled.getValue(),
    hasTypingIndicators: settingTypingIndicators.getValue(),
    isPhoneNumberSharingSupported: ipcPNP(),
    lastSyncTime: settingLastSyncTime.getValue(),
    notificationContent: settingNotificationSetting.getValue(),
    selectedCamera: settingVideoInput.getValue(),
    selectedMicrophone: settingAudioInput.getValue(),
    selectedSpeaker: settingAudioOutput.getValue(),
    systemTraySetting: settingSystemTraySetting.getValue(),
    themeSetting: settingTheme.getValue(),
    universalExpireTimer: settingUniversalExpireTimer.getValue(),
    whoCanFindMe: settingPhoneNumberDiscoverability.getValue(),
    whoCanSeeMe: settingPhoneNumberSharing.getValue(),
    zoomFactor: settingZoomFactor.getValue(),

    // Callbacks
    availableIODevices: ipcGetAvailableIODevices(),
    customColors: ipcGetCustomColors(),
    defaultConversationColor: ipcGetDefaultConversationColor(),
    isSyncNotSupported: ipcIsSyncNotSupported(),
    shouldShowStoriesSettings: ipcShouldShowStoriesSettings(),
  });

  const { availableCameras, availableMicrophones, availableSpeakers } =
    availableIODevices;

  const { hasMinimizeToAndStartInSystemTray, hasMinimizeToSystemTray } =
    getSystemTraySettingValues(systemTraySetting);

  const props = {
    // Settings
    availableCameras,
    availableMicrophones,
    availableSpeakers,
    blockedCount,
    customColors,
    defaultConversationColor,
    deviceName,
    hasAudioNotifications,
    hasAutoDownloadUpdate,
    hasAutoLaunch,
    hasCallNotifications,
    hasCallRingtoneNotification,
    hasCountMutedConversations,
    hasHideMenuBar,
    hasIncomingCallNotifications,
    hasLinkPreviews,
    hasMediaCameraPermissions,
    hasMediaPermissions,
    hasMinimizeToAndStartInSystemTray,
    hasMinimizeToSystemTray,
    hasNotificationAttention,
    hasNotifications: notificationContent !== 'off',
    hasReadReceipts,
    hasRelayCalls,
    hasSpellCheck,
    hasStoriesEnabled,
    hasTypingIndicators,
    lastSyncTime,
    notificationContent,
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
    themeSetting,
    universalExpireTimer,
    whoCanFindMe,
    whoCanSeeMe,
    zoomFactor,

    // Actions and other props
    addCustomColor: ipcAddCustomColor,
    closeSettings: () => SignalContext.executeMenuRole('close'),
    doDeleteAllData: () => ipcRenderer.send('delete-all-data'),
    doneRendering,
    editCustomColor: ipcEditCustomColor,
    getConversationsWithCustomColor: ipcGetConversationsWithCustomColor,
    initialSpellCheckSetting:
      SignalContext.config.appStartInitialSpellcheckSetting,
    makeSyncRequest: ipcMakeSyncRequest,
    removeCustomColor: ipcRemoveCustomColor,
    removeCustomColorOnConversations: ipcRemoveCustomColorOnConversations,
    resetAllChatColors: ipcResetAllChatColors,
    resetDefaultChatColor: ipcResetDefaultChatColor,
    setGlobalDefaultConversationColor: ipcSetGlobalDefaultConversationColor,
    shouldShowStoriesSettings,

    // Limited support features
    isAudioNotificationsSupported: Settings.isAudioNotificationSupported(),
    isAutoDownloadUpdatesSupported: Settings.isAutoDownloadUpdatesSupported(),
    isAutoLaunchSupported: Settings.isAutoLaunchSupported(),
    isHideMenuBarSupported: Settings.isHideMenuBarSupported(),
    isNotificationAttentionSupported: Settings.isDrawAttentionSupported(),
    isPhoneNumberSharingSupported,
    isSyncSupported: !isSyncNotSupported,
    isSystemTraySupported: Settings.isSystemTraySupported(
      SignalContext.getVersion()
    ),

    // Change handlers
    onAudioNotificationsChange: reRender(settingAudioNotification.setValue),
    onAutoDownloadUpdateChange: reRender(settingAutoDownloadUpdate.setValue),
    onAutoLaunchChange: reRender(settingAutoLaunch.setValue),
    onCallNotificationsChange: reRender(settingCallSystemNotification.setValue),
    onCallRingtoneNotificationChange: reRender(
      settingCallRingtoneNotification.setValue
    ),
    onCountMutedConversationsChange: reRender(
      settingCountMutedConversations.setValue
    ),
    onHasStoriesEnabledChanged: reRender(settingHasStoriesEnabled.setValue),
    onHideMenuBarChange: reRender(settingHideMenuBar.setValue),
    onIncomingCallNotificationsChange: reRender(
      settingIncomingCallNotification.setValue
    ),
    onLastSyncTimeChange: reRender(settingLastSyncTime.setValue),
    onMediaCameraPermissionsChange: reRender(
      settingMediaCameraPermissions.setValue
    ),
    onMinimizeToAndStartInSystemTrayChange: reRender(async (value: boolean) => {
      await settingSystemTraySetting.setValue(
        value
          ? SystemTraySetting.MinimizeToAndStartInSystemTray
          : SystemTraySetting.MinimizeToSystemTray
      );
      return value;
    }),
    onMinimizeToSystemTrayChange: reRender(async (value: boolean) => {
      await settingSystemTraySetting.setValue(
        value
          ? SystemTraySetting.MinimizeToSystemTray
          : SystemTraySetting.DoNotUseSystemTray
      );
      return value;
    }),
    onMediaPermissionsChange: reRender(settingMediaPermissions.setValue),
    onNotificationAttentionChange: reRender(
      settingNotificationDrawAttention.setValue
    ),
    onNotificationContentChange: reRender(settingNotificationSetting.setValue),
    onNotificationsChange: reRender(async (value: boolean) => {
      await settingNotificationSetting.setValue(
        value ? DEFAULT_NOTIFICATION_SETTING : 'off'
      );
      return value;
    }),
    onRelayCallsChange: reRender(settingRelayCalls.setValue),
    onSelectedCameraChange: reRender(settingVideoInput.setValue),
    onSelectedMicrophoneChange: reRender(settingAudioInput.setValue),
    onSelectedSpeakerChange: reRender(settingAudioOutput.setValue),
    onSpellCheckChange: reRender(settingSpellCheck.setValue),
    onThemeChange: reRender(settingTheme.setValue),
    onUniversalExpireTimerChange: reRender(
      settingUniversalExpireTimer.setValue
    ),

    // Zoom factor change doesn't require immediate rerender since it will:
    // 1. Update the zoom factor in the main window
    // 2. Trigger `preferred-size-changed` in the main process
    // 3. Finally result in `window.storage` update which will cause the
    //    rerender.
    onZoomFactorChange: settingZoomFactor.setValue,

    i18n: SignalContext.i18n,

    hasCustomTitleBar: SignalContext.OS.hasCustomTitleBar(),
    executeMenuRole: SignalContext.executeMenuRole,
  };

  function reRender<Value>(f: (value: Value) => Promise<Value>) {
    return async (value: Value) => {
      await f(value);
      renderPreferences();
    };
  }

  ReactDOM.render(
    React.createElement(Preferences, props),
    document.getElementById('app')
  );
};

ipcRenderer.on('preferences-changed', () => renderPreferences());

contextBridge.exposeInMainWorld('SignalContext', {
  ...SignalContext,
  renderWindow: renderPreferences,
});
