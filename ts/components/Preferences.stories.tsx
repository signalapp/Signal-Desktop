// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './Preferences';
import { Preferences } from './Preferences';
import { setupI18n } from '../util/setupI18n';
import { DEFAULT_CONVERSATION_COLOR } from '../types/Colors';
import { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';

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

const createProps = (): PropsType => ({
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
  hasTypingIndicators: true,
  lastSyncTime: Date.now(),
  notificationContent: 'name',
  selectedCamera:
    'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
  selectedMicrophone: availableMicrophones[0],
  selectedSpeaker: availableSpeakers[1],
  themeSetting: 'system',
  universalExpireTimer: 3600,
  whoCanFindMe: PhoneNumberDiscoverability.Discoverable,
  whoCanSeeMe: PhoneNumberSharingMode.Everybody,
  zoomFactor: 1,

  addCustomColor: action('addCustomColor'),
  closeSettings: action('closeSettings'),
  doDeleteAllData: action('doDeleteAllData'),
  doneRendering: action('doneRendering'),
  editCustomColor: action('editCustomColor'),
  getConversationsWithCustomColor: () => Promise.resolve([]),
  initialSpellCheckSetting: true,
  makeSyncRequest: () => {
    action('makeSyncRequest');
    return Promise.resolve();
  },
  removeCustomColor: action('removeCustomColor'),
  removeCustomColorOnConversations: action('removeCustomColorOnConversations'),
  resetAllChatColors: action('resetAllChatColors'),
  resetDefaultChatColor: action('resetDefaultChatColor'),
  setGlobalDefaultConversationColor: action(
    'setGlobalDefaultConversationColor'
  ),

  isAudioNotificationsSupported: true,
  isAutoDownloadUpdatesSupported: true,
  isAutoLaunchSupported: true,
  isHideMenuBarSupported: true,
  isNotificationAttentionSupported: true,
  isPhoneNumberSharingSupported: false,
  isSyncSupported: true,
  isSystemTraySupported: true,

  onAudioNotificationsChange: action('onAudioNotificationsChange'),
  onAutoDownloadUpdateChange: action('onAutoDownloadUpdateChange'),
  onAutoLaunchChange: action('onAutoLaunchChange'),
  onCallNotificationsChange: action('onCallNotificationsChange'),
  onCallRingtoneNotificationChange: action('onCallRingtoneNotificationChange'),
  onCountMutedConversationsChange: action('onCountMutedConversationsChange'),
  onHideMenuBarChange: action('onHideMenuBarChange'),
  onIncomingCallNotificationsChange: action(
    'onIncomingCallNotificationsChange'
  ),
  onLastSyncTimeChange: action('onLastSyncTimeChange'),
  onMediaCameraPermissionsChange: action('onMediaCameraPermissionsChange'),
  onMediaPermissionsChange: action('onMediaPermissionsChange'),
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
  onSpellCheckChange: action('onSpellCheckChange'),
  onThemeChange: action('onThemeChange'),
  onUniversalExpireTimerChange: action('onUniversalExpireTimerChange'),
  onZoomFactorChange: action('onZoomFactorChange'),

  i18n,
});

const story = storiesOf('Components/Preferences', module);

story.add('Preferences', () => <Preferences {...createProps()} />);

story.add('Blocked 1', () => (
  <Preferences {...createProps()} blockedCount={1} />
));

story.add('Blocked Many', () => (
  <Preferences {...createProps()} blockedCount={55} />
));

story.add('Custom universalExpireTimer', () => (
  <Preferences {...createProps()} universalExpireTimer={9000} />
));
