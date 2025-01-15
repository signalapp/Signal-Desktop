// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';
import { MinimalSignalContext } from '../minimalContext';

import type { PropsPreloadType } from '../../components/Preferences';
import OS from '../../util/os/osPreload';
import * as Settings from '../../types/Settings';
import {
  SystemTraySetting,
  parseSystemTraySetting,
  shouldMinimizeToSystemTray,
} from '../../types/SystemTraySetting';
import { awaitObject } from '../../util/awaitObject';
import { DurationInSeconds } from '../../util/durations';
import { createSetting, createCallback } from '../../util/preload';
import { findBestMatchingAudioDeviceIndex } from '../../calling/findBestMatchingDevice';

function doneRendering() {
  ipcRenderer.send('settings-done-rendering');
}

const settingMessageAudio = createSetting('audioMessage');
const settingAudioNotification = createSetting('audioNotification');
const settingAutoConvertEmoji = createSetting('autoConvertEmoji');
const settingAutoDownloadUpdate = createSetting('autoDownloadUpdate');
const settingAutoLaunch = createSetting('autoLaunch');
const settingCallRingtoneNotification = createSetting(
  'callRingtoneNotification'
);
const settingCallSystemNotification = createSetting('callSystemNotification');
const settingCountMutedConversations = createSetting('countMutedConversations');
const settingDeviceName = createSetting('deviceName', { setter: false });
const settingPhoneNumber = createSetting('phoneNumber', { setter: false });
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
const settingSentMediaQuality = createSetting('sentMediaQualitySetting');
const settingSpellCheck = createSetting('spellCheck');
const settingTextFormatting = createSetting('textFormatting');
const settingTheme = createSetting('themeSetting');
const settingSystemTraySetting = createSetting('systemTraySetting');
const settingLocaleOverride = createSetting('localeOverride');

const settingLastSyncTime = createSetting('lastSyncTime');

const settingHasStoriesDisabled = createSetting('hasStoriesDisabled');
const settingZoomFactor = createSetting('zoomFactor');

// Getters only.
const settingBlockedCount = createSetting('blockedCount');
const settingLinkPreview = createSetting('linkPreviewSetting', {
  setter: false,
});
const settingPhoneNumberDiscoverability = createSetting(
  'phoneNumberDiscoverabilitySetting'
);
const settingPhoneNumberSharing = createSetting('phoneNumberSharingSetting');
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
const ipcDeleteAllMyStories = createCallback('deleteAllMyStories');

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

let renderInBrowser = (_props: PropsPreloadType): void => {
  throw new Error('render is not defined');
};

function attachRenderCallback<Value>(f: (value: Value) => Promise<Value>) {
  return async (value: Value) => {
    await f(value);
    void renderPreferences();
  };
}

async function renderPreferences() {
  const {
    blockedCount,
    deviceName,
    hasAudioNotifications,
    hasAutoConvertEmoji,
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
    hasMessageAudio,
    hasNotificationAttention,
    hasReadReceipts,
    hasRelayCalls,
    hasSpellCheck,
    hasStoriesDisabled,
    hasTextFormatting,
    hasTypingIndicators,
    lastSyncTime,
    notificationContent,
    phoneNumber,
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
    sentMediaQualitySetting,
    localeOverride,
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
  } = await awaitObject({
    blockedCount: settingBlockedCount.getValue(),
    deviceName: settingDeviceName.getValue(),
    hasAudioNotifications: settingAudioNotification.getValue(),
    hasAutoConvertEmoji: settingAutoConvertEmoji.getValue(),
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
    hasMessageAudio: settingMessageAudio.getValue(),
    hasNotificationAttention: settingNotificationDrawAttention.getValue(),
    hasReadReceipts: settingReadReceipts.getValue(),
    hasRelayCalls: settingRelayCalls.getValue(),
    hasSpellCheck: settingSpellCheck.getValue(),
    hasStoriesDisabled: settingHasStoriesDisabled.getValue(),
    hasTextFormatting: settingTextFormatting.getValue(),
    hasTypingIndicators: settingTypingIndicators.getValue(),
    lastSyncTime: settingLastSyncTime.getValue(),
    notificationContent: settingNotificationSetting.getValue(),
    phoneNumber: settingPhoneNumber.getValue(),
    selectedCamera: settingVideoInput.getValue(),
    selectedMicrophone: settingAudioInput.getValue(),
    selectedSpeaker: settingAudioOutput.getValue(),
    sentMediaQualitySetting: settingSentMediaQuality.getValue(),
    localeOverride: settingLocaleOverride.getValue(),
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
  });

  const { availableCameras, availableMicrophones, availableSpeakers } =
    availableIODevices;

  const { hasMinimizeToAndStartInSystemTray, hasMinimizeToSystemTray } =
    getSystemTraySettingValues(systemTraySetting);

  const onUniversalExpireTimerChange = attachRenderCallback(
    settingUniversalExpireTimer.setValue
  );

  const availableLocales = MinimalSignalContext.getI18nAvailableLocales();
  const resolvedLocale = MinimalSignalContext.getI18nLocale();
  const preferredSystemLocales =
    MinimalSignalContext.getPreferredSystemLocales();

  const selectedMicIndex = findBestMatchingAudioDeviceIndex(
    {
      available: availableMicrophones,
      preferred: selectedMicrophone,
    },
    OS.isWindows()
  );
  const recomputedSelectedMicrophone =
    selectedMicIndex !== undefined
      ? availableMicrophones[selectedMicIndex]
      : undefined;

  const selectedSpeakerIndex = findBestMatchingAudioDeviceIndex(
    {
      available: availableSpeakers,
      preferred: selectedSpeaker,
    },
    OS.isWindows()
  );
  const recomputedSelectedSpeaker =
    selectedSpeakerIndex !== undefined
      ? availableSpeakers[selectedSpeakerIndex]
      : undefined;

  const props = {
    // Settings
    availableCameras,
    availableLocales,
    availableMicrophones,
    availableSpeakers,
    blockedCount,
    customColors,
    defaultConversationColor,
    deviceName,
    hasAudioNotifications,
    hasAutoConvertEmoji,
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
    hasMessageAudio,
    hasMinimizeToAndStartInSystemTray,
    hasMinimizeToSystemTray,
    hasNotificationAttention,
    hasNotifications: notificationContent !== 'off',
    hasReadReceipts,
    hasRelayCalls,
    hasSpellCheck,
    hasStoriesDisabled,
    hasTextFormatting,
    hasTypingIndicators,
    lastSyncTime,
    localeOverride,
    notificationContent,
    phoneNumber,
    preferredSystemLocales,
    resolvedLocale,
    selectedCamera,
    selectedMicrophone: recomputedSelectedMicrophone,
    selectedSpeaker: recomputedSelectedSpeaker,
    sentMediaQualitySetting,
    themeSetting,
    universalExpireTimer: DurationInSeconds.fromSeconds(universalExpireTimer),
    whoCanFindMe,
    whoCanSeeMe,
    zoomFactor,

    // Actions and other props
    addCustomColor: ipcAddCustomColor,
    closeSettings: () => MinimalSignalContext.executeMenuRole('close'),
    doDeleteAllData: () => ipcRenderer.send('delete-all-data'),
    doneRendering,
    editCustomColor: ipcEditCustomColor,
    getConversationsWithCustomColor: ipcGetConversationsWithCustomColor,
    initialSpellCheckSetting:
      MinimalSignalContext.config.appStartInitialSpellcheckSetting,
    makeSyncRequest: ipcMakeSyncRequest,
    removeCustomColor: ipcRemoveCustomColor,
    removeCustomColorOnConversations: ipcRemoveCustomColorOnConversations,
    resetAllChatColors: ipcResetAllChatColors,
    resetDefaultChatColor: ipcResetDefaultChatColor,
    setGlobalDefaultConversationColor: ipcSetGlobalDefaultConversationColor,

    // Limited support features
    isAutoDownloadUpdatesSupported: Settings.isAutoDownloadUpdatesSupported(
      OS,
      MinimalSignalContext.getVersion()
    ),
    isAutoLaunchSupported: Settings.isAutoLaunchSupported(OS),
    isHideMenuBarSupported: Settings.isHideMenuBarSupported(OS),
    isNotificationAttentionSupported: Settings.isDrawAttentionSupported(OS),
    isSyncSupported: !isSyncNotSupported,
    isSystemTraySupported: Settings.isSystemTraySupported(OS),
    isMinimizeToAndStartInSystemTraySupported:
      Settings.isMinimizeToAndStartInSystemTraySupported(OS),

    // Change handlers
    onAudioNotificationsChange: attachRenderCallback(
      settingAudioNotification.setValue
    ),
    onAutoConvertEmojiChange: attachRenderCallback(
      settingAutoConvertEmoji.setValue
    ),
    onAutoDownloadUpdateChange: attachRenderCallback(
      settingAutoDownloadUpdate.setValue
    ),
    onAutoLaunchChange: attachRenderCallback(settingAutoLaunch.setValue),
    onCallNotificationsChange: attachRenderCallback(
      settingCallSystemNotification.setValue
    ),
    onCallRingtoneNotificationChange: attachRenderCallback(
      settingCallRingtoneNotification.setValue
    ),
    onCountMutedConversationsChange: attachRenderCallback(
      settingCountMutedConversations.setValue
    ),
    onHasStoriesDisabledChanged: attachRenderCallback(
      async (value: boolean) => {
        await settingHasStoriesDisabled.setValue(value);
        if (!value) {
          void ipcDeleteAllMyStories();
        }
        return value;
      }
    ),
    onHideMenuBarChange: attachRenderCallback(settingHideMenuBar.setValue),
    onIncomingCallNotificationsChange: attachRenderCallback(
      settingIncomingCallNotification.setValue
    ),
    onLastSyncTimeChange: attachRenderCallback(settingLastSyncTime.setValue),
    onLocaleChange: async (locale: string | null) => {
      await settingLocaleOverride.setValue(locale);
      MinimalSignalContext.restartApp();
    },
    onMediaCameraPermissionsChange: attachRenderCallback(
      settingMediaCameraPermissions.setValue
    ),
    onMessageAudioChange: attachRenderCallback(settingMessageAudio.setValue),
    onMinimizeToAndStartInSystemTrayChange: attachRenderCallback(
      async (value: boolean) => {
        await settingSystemTraySetting.setValue(
          value
            ? SystemTraySetting.MinimizeToAndStartInSystemTray
            : SystemTraySetting.MinimizeToSystemTray
        );
        return value;
      }
    ),
    onMinimizeToSystemTrayChange: attachRenderCallback(
      async (value: boolean) => {
        await settingSystemTraySetting.setValue(
          value
            ? SystemTraySetting.MinimizeToSystemTray
            : SystemTraySetting.DoNotUseSystemTray
        );
        return value;
      }
    ),
    onMediaPermissionsChange: attachRenderCallback(
      settingMediaPermissions.setValue
    ),
    onNotificationAttentionChange: attachRenderCallback(
      settingNotificationDrawAttention.setValue
    ),
    onNotificationContentChange: attachRenderCallback(
      settingNotificationSetting.setValue
    ),
    onNotificationsChange: attachRenderCallback(async (value: boolean) => {
      await settingNotificationSetting.setValue(
        value ? DEFAULT_NOTIFICATION_SETTING : 'off'
      );
      return value;
    }),
    onRelayCallsChange: attachRenderCallback(settingRelayCalls.setValue),
    onSelectedCameraChange: attachRenderCallback(settingVideoInput.setValue),
    onSelectedMicrophoneChange: attachRenderCallback(
      settingAudioInput.setValue
    ),
    onSelectedSpeakerChange: attachRenderCallback(settingAudioOutput.setValue),
    onSentMediaQualityChange: attachRenderCallback(
      settingSentMediaQuality.setValue
    ),
    onSpellCheckChange: attachRenderCallback(settingSpellCheck.setValue),
    onTextFormattingChange: attachRenderCallback(
      settingTextFormatting.setValue
    ),
    onThemeChange: attachRenderCallback(settingTheme.setValue),
    onUniversalExpireTimerChange: (newValue: number): Promise<void> => {
      return onUniversalExpireTimerChange(
        DurationInSeconds.fromSeconds(newValue)
      );
    },

    onWhoCanFindMeChange: attachRenderCallback(
      settingPhoneNumberDiscoverability.setValue
    ),
    onWhoCanSeeMeChange: attachRenderCallback(
      settingPhoneNumberSharing.setValue
    ),
    onZoomFactorChange: (zoomFactorValue: number) => {
      ipcRenderer.send('setZoomFactor', zoomFactorValue);
    },
  };

  renderInBrowser(props);
}

ipcRenderer.on('preferences-changed', renderPreferences);
ipcRenderer.on('zoomFactorChanged', renderPreferences);

const Signal = {
  SettingsWindowProps: {
    onRender: (renderer: (_props: PropsPreloadType) => void) => {
      renderInBrowser = renderer;
      void renderPreferences();
    },
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
