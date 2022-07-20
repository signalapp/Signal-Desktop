// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import enMessages from '../../_locales/en/messages.json';
import type { PropsDataType, PropsType } from './Preferences';
import { Preferences } from './Preferences';
import { setupI18n } from '../util/setupI18n';
import { DEFAULT_CONVERSATION_COLOR } from '../types/Colors';
import { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import { objectMap } from '../util/objectMap';

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

const getDefaultArgs = (): PropsDataType => ({
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
  availableMicrophones,
  availableSpeakers,
  blockedCount: 0,
  customColors: {},
  defaultConversationColor: DEFAULT_CONVERSATION_COLOR,
  deviceName: 'Work Windows ME',
  hasAudioNotifications: true,
  hasAutoDownloadUpdate: true,
  hasAutoLaunch: true,
  hasCallNotifications: true,
  hasCallRingtoneNotification: false,
  hasCountMutedConversations: false,
  hasCustomTitleBar: true,
  hasHideMenuBar: false,
  hasIncomingCallNotifications: true,
  hasLinkPreviews: true,
  hasMediaCameraPermissions: true,
  hasMediaPermissions: true,
  hasMinimizeToAndStartInSystemTray: true,
  hasMinimizeToSystemTray: true,
  hasNotificationAttention: false,
  hasNotifications: true,
  hasReadReceipts: true,
  hasRelayCalls: false,
  hasSpellCheck: true,
  hasStoriesEnabled: true,
  hasTypingIndicators: true,
  initialSpellCheckSetting: true,
  isAudioNotificationsSupported: true,
  isAutoDownloadUpdatesSupported: true,
  isAutoLaunchSupported: true,
  isHideMenuBarSupported: true,
  isNotificationAttentionSupported: true,
  isPhoneNumberSharingSupported: false,
  isSyncSupported: true,
  isSystemTraySupported: true,
  lastSyncTime: Date.now(),
  notificationContent: 'name',
  selectedCamera:
    'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
  selectedMicrophone: availableMicrophones[0],
  selectedSpeaker: availableSpeakers[1],
  shouldShowStoriesSettings: true,
  themeSetting: 'system',
  universalExpireTimer: 3600,
  whoCanFindMe: PhoneNumberDiscoverability.Discoverable,
  whoCanSeeMe: PhoneNumberSharingMode.Everybody,
  zoomFactor: 1,
});

const defaultArgTypes: Record<string, { defaultValue: unknown }> = {};
objectMap(getDefaultArgs(), (key, defaultValue) => {
  defaultArgTypes[key] = { defaultValue };
});

export default {
  title: 'Components/Preferences',
  component: Preferences,
  argTypes: {
    // ...defaultArgTypes,

    i18n: {
      defaultValue: i18n,
    },

    addCustomColor: { action: true },
    closeSettings: { action: true },
    doDeleteAllData: { action: true },
    doneRendering: { action: true },
    editCustomColor: { action: true },
    executeMenuRole: { action: true },
    getConversationsWithCustomColor: { action: true },
    makeSyncRequest: { action: true },
    onAudioNotificationsChange: { action: true },
    onAutoDownloadUpdateChange: { action: true },
    onAutoLaunchChange: { action: true },
    onCallNotificationsChange: { action: true },
    onCallRingtoneNotificationChange: { action: true },
    onCountMutedConversationsChange: { action: true },
    onHasStoriesEnabledChanged: { action: true },
    onHideMenuBarChange: { action: true },
    onIncomingCallNotificationsChange: { action: true },
    onLastSyncTimeChange: { action: true },
    onMediaCameraPermissionsChange: { action: true },
    onMediaPermissionsChange: { action: true },
    onMinimizeToAndStartInSystemTrayChange: { action: true },
    onMinimizeToSystemTrayChange: { action: true },
    onNotificationAttentionChange: { action: true },
    onNotificationContentChange: { action: true },
    onNotificationsChange: { action: true },
    onRelayCallsChange: { action: true },
    onSelectedCameraChange: { action: true },
    onSelectedMicrophoneChange: { action: true },
    onSelectedSpeakerChange: { action: true },
    onSpellCheckChange: { action: true },
    onThemeChange: { action: true },
    onUniversalExpireTimerChange: { action: true },
    onZoomFactorChange: { action: true },
    removeCustomColor: { action: true },
    removeCustomColorOnConversations: { action: true },
    resetAllChatColors: { action: true },
    resetDefaultChatColor: { action: true },
    setGlobalDefaultConversationColor: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <Preferences {...args} />;

export const _Preferences = Template.bind({});
_Preferences.args = getDefaultArgs();

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
  universalExpireTimer: 9000,
};
CustomUniversalExpireTimer.story = {
  name: 'Custom universalExpireTimer',
};
