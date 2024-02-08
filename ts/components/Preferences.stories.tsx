// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './Preferences';
import { Preferences } from './Preferences';
import { setupI18n } from '../util/setupI18n';
import { DEFAULT_CONVERSATION_COLOR } from '../types/Colors';
import { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import { DurationInSeconds } from '../util/durations';

const i18n = setupI18n('en', enMessages);

const availableMicrophones = [
  {
    name: 'DefAuLt (Headphones)',
    index: 0,
    uniqueId: 'Default',
    i18nKey: 'default_communication_device',
  },
];

const availableSpeakers = [
  {
    name: 'Default',
    index: 0,
    uniqueId: 'Default',
    i18nKey: 'default_communication_device',
  },
  {
    name: "Natalie's Airpods (Bluetooth)",
    index: 1,
    uniqueId: 'aa',
  },
  {
    name: 'UE Boom (Bluetooth)',
    index: 2,
    uniqueId: 'bb',
  },
];

export default {
  title: 'Components/Preferences',
  component: Preferences,
  args: {
    i18n,

    availableCameras: [
      {
        deviceId:
          'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
        groupId:
          '63ee218d2446869e40adfc958ff98263e51f74382b0143328ee4826f20a76f47',
        kind: 'videoinput' as MediaDeviceKind,
        label: 'FaceTime HD Camera (Built-in) (9fba:bced)',
      },
      {
        deviceId:
          'e2db196a31d50ff9b135299dc0beea67f65b1a25a06d8a4ce76976751bb7a08d',
        groupId:
          '218ba7f00d7b1239cca15b9116769e5e7d30cc01104ebf84d667643661e0ecf9',
        kind: 'videoinput' as MediaDeviceKind,
        label: 'Logitech Webcam (4e72:9058)',
      },
    ],
    availableLocales: ['en'],
    availableMicrophones,
    availableSpeakers,
    blockedCount: 0,
    customColors: {},
    defaultConversationColor: DEFAULT_CONVERSATION_COLOR,
    deviceName: 'Work Windows ME',
    phoneNumber: '+1 555 123-4567',
    hasAudioNotifications: true,
    hasAutoConvertEmoji: true,
    hasAutoDownloadUpdate: true,
    hasAutoLaunch: true,
    hasCallNotifications: true,
    hasCallRingtoneNotification: false,
    hasCountMutedConversations: false,
    hasHideMenuBar: false,
    hasIncomingCallNotifications: true,
    hasLinkPreviews: true,
    hasMediaCameraPermissions: true,
    hasMediaPermissions: true,
    hasMessageAudio: true,
    hasMinimizeToAndStartInSystemTray: true,
    hasMinimizeToSystemTray: true,
    hasNotificationAttention: false,
    hasNotifications: true,
    hasReadReceipts: true,
    hasRelayCalls: false,
    hasSpellCheck: true,
    hasStoriesDisabled: false,
    hasTextFormatting: true,
    hasTypingIndicators: true,
    initialSpellCheckSetting: true,
    isAutoDownloadUpdatesSupported: true,
    isAutoLaunchSupported: true,
    isHideMenuBarSupported: true,
    isNotificationAttentionSupported: true,
    isSyncSupported: true,
    isSystemTraySupported: true,
    isMinimizeToAndStartInSystemTraySupported: true,
    lastSyncTime: Date.now(),
    localeOverride: null,
    notificationContent: 'name',
    preferredSystemLocales: ['en'],
    resolvedLocale: 'en',
    selectedCamera:
      'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
    selectedMicrophone: availableMicrophones[0],
    selectedSpeaker: availableSpeakers[1],
    sentMediaQualitySetting: 'standard',
    themeSetting: 'system',
    universalExpireTimer: DurationInSeconds.HOUR,
    whoCanFindMe: PhoneNumberDiscoverability.Discoverable,
    whoCanSeeMe: PhoneNumberSharingMode.Everybody,
    zoomFactor: 1,

    getConversationsWithCustomColor: () => Promise.resolve([]),

    addCustomColor: action('addCustomColor'),
    closeSettings: action('closeSettings'),
    doDeleteAllData: action('doDeleteAllData'),
    doneRendering: action('doneRendering'),
    editCustomColor: action('editCustomColor'),
    makeSyncRequest: action('makeSyncRequest'),
    onAudioNotificationsChange: action('onAudioNotificationsChange'),
    onAutoConvertEmojiChange: action('onAutoConvertEmojiChange'),
    onAutoDownloadUpdateChange: action('onAutoDownloadUpdateChange'),
    onAutoLaunchChange: action('onAutoLaunchChange'),
    onCallNotificationsChange: action('onCallNotificationsChange'),
    onCallRingtoneNotificationChange: action(
      'onCallRingtoneNotificationChange'
    ),
    onCountMutedConversationsChange: action('onCountMutedConversationsChange'),
    onHasStoriesDisabledChanged: action('onHasStoriesDisabledChanged'),
    onHideMenuBarChange: action('onHideMenuBarChange'),
    onIncomingCallNotificationsChange: action(
      'onIncomingCallNotificationsChange'
    ),
    onLocaleChange: action('onLocaleChange'),
    onLastSyncTimeChange: action('onLastSyncTimeChange'),
    onMediaCameraPermissionsChange: action('onMediaCameraPermissionsChange'),
    onMediaPermissionsChange: action('onMediaPermissionsChange'),
    onMessageAudioChange: action('onMessageAudioChange'),
    onMinimizeToAndStartInSystemTrayChange: action(
      'onMinimizeToAndStartInSystemTrayChange'
    ),
    onMinimizeToSystemTrayChange: action('onMinimizeToSystemTrayChange'),
    onNotificationAttentionChange: action('onNotificationAttentionChange'),
    onNotificationContentChange: action('onNotificationContentChange'),
    onNotificationsChange: action('onNotificationsChange'),
    onRelayCallsChange: action('onRelayCallsChange'),
    onSelectedCameraChange: action('onSelectedCameraChange'),
    onSelectedMicrophoneChange: action('onSelectedMicrophoneChange'),
    onSelectedSpeakerChange: action('onSelectedSpeakerChange'),
    onSentMediaQualityChange: action('onSentMediaQualityChange'),
    onSpellCheckChange: action('onSpellCheckChange'),
    onTextFormattingChange: action('onTextFormattingChange'),
    onThemeChange: action('onThemeChange'),
    onUniversalExpireTimerChange: action('onUniversalExpireTimerChange'),
    onWhoCanSeeMeChange: action('onWhoCanSeeMeChange'),
    onWhoCanFindMeChange: action('onWhoCanFindMeChange'),
    onZoomFactorChange: action('onZoomFactorChange'),
    removeCustomColor: action('removeCustomColor'),
    removeCustomColorOnConversations: action(
      'removeCustomColorOnConversations'
    ),
    resetAllChatColors: action('resetAllChatColors'),
    resetDefaultChatColor: action('resetDefaultChatColor'),
    setGlobalDefaultConversationColor: action(
      'setGlobalDefaultConversationColor'
    ),
  } satisfies PropsType,
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <Preferences {...args} />;

export const _Preferences = Template.bind({});

export const Blocked1 = Template.bind({});
Blocked1.args = {
  blockedCount: 1,
};

export const BlockedMany = Template.bind({});
BlockedMany.args = {
  blockedCount: 55,
};

export const CustomUniversalExpireTimer = Template.bind({});
CustomUniversalExpireTimer.args = {
  universalExpireTimer: DurationInSeconds.fromSeconds(9000),
};

export const PNPSharingDisabled = Template.bind({});
PNPSharingDisabled.args = {
  whoCanSeeMe: PhoneNumberSharingMode.Nobody,
  whoCanFindMe: PhoneNumberDiscoverability.Discoverable,
};

export const PNPDiscoverabilityDisabled = Template.bind({});
PNPDiscoverabilityDisabled.args = {
  whoCanSeeMe: PhoneNumberSharingMode.Nobody,
  whoCanFindMe: PhoneNumberDiscoverability.NotDiscoverable,
};
