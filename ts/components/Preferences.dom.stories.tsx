// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';
import type { MutableRefObject } from 'react';
import { action } from '@storybook/addon-actions';
import lodash from 'lodash';

import { Preferences } from './Preferences.dom.js';
import { DEFAULT_CONVERSATION_COLOR } from '../types/Colors.std.js';
import { PhoneNumberSharingMode } from '../types/PhoneNumberSharingMode.std.js';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability.std.js';
import { EmojiSkinTone } from './fun/data/emojis.std.js';
import {
  DAY,
  DurationInSeconds,
  HOUR,
  WEEK,
} from '../util/durations/index.std.js';
import { DialogUpdate } from './DialogUpdate.dom.js';
import { DialogType } from '../types/Dialogs.std.js';
import { ThemeType } from '../types/Util.std.js';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-helpers/getDefaultConversation.std.js';
import { ProfileEditor } from './ProfileEditor.dom.js';
import {
  UsernameEditState,
  UsernameLinkState,
} from '../state/ducks/usernameEnums.std.js';
import type { SettingsLocation } from '../types/Nav.std.js';
import { NavTab, ProfileEditorPage, SettingsPage } from '../types/Nav.std.js';
import { PreferencesDonations } from './PreferencesDonations.dom.js';
import { strictAssert } from '../util/assert.std.js';
import { PreferencesChatFoldersPage } from './preferences/chatFolders/PreferencesChatFoldersPage.dom.js';
import { PreferencesEditChatFolderPage } from './preferences/chatFolders/PreferencesEditChatFoldersPage.dom.js';
import { CHAT_FOLDER_DEFAULTS } from '../types/ChatFolder.std.js';
import {
  NotificationProfilesHome,
  NotificationProfilesCreateFlow,
} from './PreferencesNotificationProfiles.dom.js';
import { DayOfWeek } from '../types/NotificationProfile.std.js';

import type { LocalizerType } from '../types/Util.std.js';
import type { PropsType } from './Preferences.dom.js';
import type { WidthBreakpoint } from './_util.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type {
  DonationReceipt,
  DonationWorkflow,
  OneTimeDonationHumanAmounts,
} from '../types/Donations.std.js';
import type { AnyToast } from '../types/Toast.dom.js';
import type { SmartPreferencesChatFoldersPageProps } from '../state/smart/PreferencesChatFoldersPage.preload.js';
import type { SmartPreferencesEditChatFolderPageProps } from '../state/smart/PreferencesEditChatFolderPage.preload.js';
import { CurrentChatFolders } from '../types/CurrentChatFolders.std.js';
import type { ExternalProps as SmartNotificationProfilesProps } from '../state/smart/PreferencesNotificationProfiles.preload.js';
import type { NotificationProfileIdString } from '../types/NotificationProfile.std.js';
import { BackupLevel } from '../services/backups/types.std.js';

const { shuffle } = lodash;

const { i18n } = window.SignalContext;

const me = {
  ...getDefaultConversation(),
  phoneNumber: '(215) 555-2345',
  username: 'someone.243',
};

const conversations = shuffle([
  ...Array.from(Array(20), getDefaultGroup),
  ...Array.from(Array(20), getDefaultConversation),
]);

function conversationSelector(conversationId?: string) {
  strictAssert(conversationId, 'Missing conversation id');
  const found = conversations.find(conversation => {
    return conversation.id === conversationId;
  });
  strictAssert(found, 'Missing conversation');
  return found;
}

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

const validateBackupResult = {
  totalBytes: 100,
  duration: 10000,
  stats: {
    adHocCalls: 1,
    callLinks: 2,
    conversations: 3,
    chats: 4,
    distributionLists: 5,
    messages: 6,
    notificationProfiles: 2,
    skippedMessages: 7,
    stickerPacks: 8,
    fixedDirectMessages: 9,
  },
};

const exportLocalBackupResult = {
  ...validateBackupResult,
  snapshotDir: '/home/signaluser/SignalBackups/signal-backup-1745618069169',
};

const donationAmountsConfig = {
  cad: {
    minimum: 4,
    oneTime: {
      1: [7, 15, 30, 40, 70, 140],
      100: [7],
    },
  },
  jpy: {
    minimum: 400,
    oneTime: {
      '1': [500, 1000, 2000, 3000, 5000, 10000],
      '100': [500],
    },
  },
  usd: {
    minimum: 3,
    oneTime: {
      1: [5, 10, 20, 30, 50, 100],
      100: [5],
    },
  },
  ugx: {
    minimum: 8000,
    oneTime: {
      1: [15000, 35000, 70000, 100000, 150000, 300000],
      100: [15000],
    },
  },
} as unknown as OneTimeDonationHumanAmounts;

function renderUpdateDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return (
    <DialogUpdate
      i18n={i18n}
      containerWidthBreakpoint={props.containerWidthBreakpoint}
      dialogType={DialogType.DownloadReady}
      downloadSize={100000}
      downloadedSize={50000}
      version="8.99.0"
      currentVersion="8.98.00"
      disableDismiss
      dismissDialog={action('dismissDialog')}
      snoozeUpdate={action('snoozeUpdate')}
      startUpdate={action('startUpdate')}
    />
  );
}
function renderProfileEditor({
  contentsRef,
}: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
}): JSX.Element {
  return (
    <ProfileEditor
      aboutEmoji={undefined}
      aboutText={undefined}
      color={undefined}
      contentsRef={contentsRef}
      conversationId="something"
      deleteAvatarFromDisk={action('deleteAvatarFromDisk')}
      deleteUsername={action('deleteUsername')}
      familyName={me.familyName}
      firstName={me.firstName ?? ''}
      hasCompletedUsernameLinkOnboarding={false}
      i18n={i18n}
      editState={ProfileEditorPage.None}
      markCompletedUsernameLinkOnboarding={action(
        'markCompletedUsernameLinkOnboarding'
      )}
      onProfileChanged={action('onProfileChanged')}
      openUsernameReservationModal={action('openUsernameReservationModal')}
      profileAvatarUrl={undefined}
      renderUsernameEditor={() => <div />}
      replaceAvatar={action('replaceAvatar')}
      resetUsernameLink={action('resetUsernameLink')}
      saveAttachment={action('saveAttachment')}
      saveAvatarToDisk={action('saveAvatarToDisk')}
      setEditState={action('setEditState')}
      setUsernameEditState={action('setUsernameEditState')}
      setUsernameLinkColor={action('setUsernameLinkColor')}
      showToast={action('showToast')}
      emojiSkinToneDefault={null}
      userAvatarData={[]}
      username={undefined}
      usernameCorrupted={false}
      usernameEditState={UsernameEditState.Editing}
      usernameLink={undefined}
      usernameLinkColor={undefined}
      usernameLinkCorrupted={false}
      usernameLinkState={UsernameLinkState.Ready}
    />
  );
}

function renderDonationsPane(props: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  settingsLocation: SettingsLocation;
  setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  me: typeof me;
  donationReceipts: ReadonlyArray<DonationReceipt>;
  saveAttachmentToDisk: (options: {
    data: Uint8Array;
    name: string;
    baseDir?: string | undefined;
  }) => Promise<{ fullPath: string; name: string } | null>;
  generateDonationReceiptBlob: (
    receipt: DonationReceipt,
    i18n: LocalizerType
  ) => Promise<Blob>;
  showToast: (toast: AnyToast) => void;
  workflow?: DonationWorkflow;
}): JSX.Element {
  return (
    <PreferencesDonations
      applyDonationBadge={action('applyDonationBadge')}
      i18n={i18n}
      contentsRef={props.contentsRef}
      clearWorkflow={action('clearWorkflow')}
      initialCurrency="usd"
      resumeWorkflow={action('resumeWorkflow')}
      isOnline
      settingsLocation={props.settingsLocation}
      setSettingsLocation={props.setSettingsLocation}
      submitDonation={action('submitDonation')}
      lastError={undefined}
      workflow={props.workflow}
      didResumeWorkflowAtStartup={false}
      badge={undefined}
      color={props.me.color}
      firstName={props.me.firstName}
      profileAvatarUrl={props.me.profileAvatarUrl}
      donationAmountsConfig={donationAmountsConfig}
      validCurrencies={Object.keys(donationAmountsConfig)}
      donationReceipts={props.donationReceipts}
      saveAttachmentToDisk={props.saveAttachmentToDisk}
      generateDonationReceiptBlob={props.generateDonationReceiptBlob}
      showToast={props.showToast}
      theme={ThemeType.light}
      updateLastError={action('updateLastError')}
      donationBadge={undefined}
      fetchBadgeData={async () => undefined}
      me={props.me}
      myProfileChanged={action('myProfileChanged')}
    />
  );
}

function renderToastManager(): JSX.Element {
  return <div />;
}

function renderPreferencesChatFoldersPage(
  props: SmartPreferencesChatFoldersPageProps
): JSX.Element {
  return (
    <PreferencesChatFoldersPage
      i18n={i18n}
      previousLocation={props.previousLocation}
      settingsPaneRef={props.settingsPaneRef}
      changeLocation={action('changeLocation')}
      currentChatFolders={CurrentChatFolders.createEmpty()}
      onOpenEditChatFoldersPage={props.onOpenEditChatFoldersPage}
      onCreateChatFolder={action('onCreateChatFolder')}
      onDeleteChatFolder={action('onDeletChatFolder')}
      onUpdateChatFoldersPositions={action('onUpdateChatFoldersPositions')}
    />
  );
}

function renderPreferencesEditChatFolderPage(
  props: SmartPreferencesEditChatFolderPageProps
): JSX.Element {
  return (
    <PreferencesEditChatFolderPage
      i18n={i18n}
      theme={ThemeType.light}
      previousLocation={{
        tab: NavTab.Settings,
        details: { page: SettingsPage.ChatFolders, previousLocation: null },
      }}
      settingsPaneRef={props.settingsPaneRef}
      existingChatFolderId={props.existingChatFolderId}
      initChatFolderParams={CHAT_FOLDER_DEFAULTS}
      changeLocation={action('changeLocation')}
      onCreateChatFolder={action('onCreateChatFolder')}
      onUpdateChatFolder={action('onUpdateChatFolder')}
      onDeleteChatFolder={action('onDeleteChatFolder')}
      conversations={conversations}
      conversationSelector={conversationSelector}
      preferredBadgeSelector={() => undefined}
    />
  );
}

function renderNotificationProfilesCreateFlow(
  props: SmartNotificationProfilesProps
): JSX.Element {
  return (
    <NotificationProfilesCreateFlow
      contentsRef={props.contentsRef}
      conversations={conversations}
      conversationSelector={conversationSelector}
      createProfile={action('createProfile')}
      i18n={i18n}
      preferredBadgeSelector={() => undefined}
      setSettingsLocation={props.setSettingsLocation}
      theme={ThemeType.light}
    />
  );
}

function renderNotificationProfilesHome(
  props: SmartNotificationProfilesProps
): JSX.Element {
  return (
    <NotificationProfilesHome
      activeProfileId={undefined}
      allProfiles={[]}
      contentsRef={props.contentsRef}
      conversations={conversations}
      conversationSelector={conversationSelector}
      hasOnboardingBeenSeen={false}
      i18n={i18n}
      isSyncEnabled
      loading={false}
      markProfileDeleted={action('markProfileDeleted')}
      preferredBadgeSelector={() => undefined}
      setHasOnboardingBeenSeen={action('setHasOnboardingBeenSeen')}
      setIsSyncEnabled={action('setIsSyncEnabled')}
      setSettingsLocation={props.setSettingsLocation}
      setProfileOverride={action('setProfileOverride')}
      theme={ThemeType.light}
      updateProfile={action('updateProfile')}
    />
  );
}

export default {
  title: 'Components/Preferences',
  component: Preferences,
  args: {
    i18n,
    accountEntropyPool:
      'uy38jh2778hjjhj8lk19ga61s672jsj089r023s6a57809bap92j2yh5t326vv7t',
    autoDownloadAttachment: {
      photos: true,
      videos: false,
      audio: false,
      documents: false,
    },
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
    backupFeatureEnabled: false,
    chatFoldersFeatureEnabled: true,
    backupFreeMediaDays: 45,
    backupKeyViewed: false,
    backupLocalBackupsEnabled: false,
    backupSubscriptionStatus: { status: 'not-found' },
    backupTier: null,
    badge: undefined,
    blockedCount: 0,
    currentChatFoldersCount: 0,
    customColors: {},
    defaultConversationColor: DEFAULT_CONVERSATION_COLOR,
    deviceName: 'Work Windows ME',
    emojiSkinToneDefault: EmojiSkinTone.None,
    phoneNumber: '+1 555 123-4567',
    hasAnyCurrentCustomChatFolders: false,
    hasAudioNotifications: true,
    hasAutoConvertEmoji: true,
    hasAutoDownloadUpdate: true,
    hasAutoLaunch: true,
    hasCallNotifications: true,
    hasCallRingtoneNotification: false,
    hasContentProtection: false,
    hasCountMutedConversations: false,
    hasFailedStorySends: false,
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
    hasKeepMutedChatsArchived: false,
    initialSpellCheckSetting: true,
    isAutoDownloadUpdatesSupported: true,
    isAutoLaunchSupported: true,
    isHideMenuBarSupported: true,
    isNotificationAttentionSupported: true,
    isSyncSupported: true,
    isSystemTraySupported: true,
    isInternalUser: false,
    isContentProtectionSupported: true,
    isContentProtectionNeeded: true,
    isMinimizeToAndStartInSystemTraySupported: true,
    lastSyncTime: Date.now(),
    localeOverride: null,
    localBackupFolder: undefined,
    me,
    navTabsCollapsed: false,
    notificationContent: 'name',
    notificationProfileCount: 0,
    otherTabsUnreadStats: {
      unreadCount: 0,
      unreadMentionsCount: 0,
      readChatsMarkedUnreadCount: 0,
    },
    settingsLocation: {
      page: SettingsPage.Profile,
      state: ProfileEditorPage.None,
    },
    preferredSystemLocales: ['en'],
    preferredWidthFromStorage: 300,
    resolvedLocale: 'en',
    selectedCamera:
      'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
    selectedMicrophone: availableMicrophones[0],
    selectedSpeaker: availableSpeakers[1],
    sentMediaQualitySetting: 'standard',
    shouldShowUpdateDialog: false,
    themeSetting: 'system',
    theme: ThemeType.light,
    universalExpireTimer: DurationInSeconds.HOUR,
    whoCanFindMe: PhoneNumberDiscoverability.Discoverable,
    whoCanSeeMe: PhoneNumberSharingMode.Everybody,
    zoomFactor: 1,

    renderDonationsPane: ({
      contentsRef,
      settingsLocation,
      setSettingsLocation,
    }: {
      contentsRef: MutableRefObject<HTMLDivElement | null>;
      settingsLocation: SettingsLocation;
      setSettingsLocation: (settingsLocation: SettingsLocation) => void;
    }) =>
      renderDonationsPane({
        contentsRef,
        settingsLocation,
        setSettingsLocation,
        me,
        donationReceipts: [],
        saveAttachmentToDisk: async () => {
          action('saveAttachmentToDisk')();
          return { fullPath: '/mock/path/to/file.png', name: 'file.png' };
        },

        generateDonationReceiptBlob: async () => {
          action('generateDonationReceiptBlob')();
          return new Blob();
        },
        showToast: action('showToast'),
      }),
    renderNotificationProfilesCreateFlow,
    renderNotificationProfilesHome,
    renderProfileEditor,
    renderToastManager,
    renderUpdateDialog,
    renderPreferencesChatFoldersPage,
    renderPreferencesEditChatFolderPage,
    getConversationsWithCustomColor: () => [],

    addCustomColor: action('addCustomColor'),
    doDeleteAllData: action('doDeleteAllData'),
    editCustomColor: action('editCustomColor'),
    exportLocalBackup: async () => {
      return {
        result: exportLocalBackupResult,
      };
    },
    getMessageCountBySchemaVersion: async () => [
      { schemaVersion: 10, count: 1024 },
      { schemaVersion: 8, count: 256 },
    ],
    getMessageSampleForSchemaVersion: async () => [
      { id: 'messageId' } as MessageAttributesType,
    ],
    makeSyncRequest: action('makeSyncRequest'),
    onAudioNotificationsChange: action('onAudioNotificationsChange'),
    onAutoConvertEmojiChange: action('onAutoConvertEmojiChange'),
    onAutoDownloadAttachmentChange: action('onAutoDownloadAttachmentChange'),
    onAutoDownloadUpdateChange: action('onAutoDownloadUpdateChange'),
    onAutoLaunchChange: action('onAutoLaunchChange'),
    onBackupKeyViewedChange: action('onBackupKeyViewedChange'),
    onCallNotificationsChange: action('onCallNotificationsChange'),
    onCallRingtoneNotificationChange: action(
      'onCallRingtoneNotificationChange'
    ),
    onContentProtectionChange: action('onContentProtectionChange'),
    onCountMutedConversationsChange: action('onCountMutedConversationsChange'),
    onEmojiSkinToneDefaultChange: action('onEmojiSkinToneDefaultChange'),
    onHasStoriesDisabledChanged: action('onHasStoriesDisabledChanged'),
    onHideMenuBarChange: action('onHideMenuBarChange'),
    onIncomingCallNotificationsChange: action(
      'onIncomingCallNotificationsChange'
    ),
    onKeepMutedChatsArchivedChange: action('onKeepMutedChatsArchivedChange'),
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
    onStartUpdate: action('onStartUpdate'),
    onTextFormattingChange: action('onTextFormattingChange'),
    onThemeChange: action('onThemeChange'),
    onToggleNavTabsCollapse: action('onToggleNavTabsCollapse'),
    onUniversalExpireTimerChange: action('onUniversalExpireTimerChange'),
    onWhoCanSeeMeChange: action('onWhoCanSeeMeChange'),
    onWhoCanFindMeChange: action('onWhoCanFindMeChange'),
    onZoomFactorChange: action('onZoomFactorChange'),
    pickLocalBackupFolder: () =>
      Promise.resolve('/home/signaluser/Signal Backups/'),
    promptOSAuth: () => Promise.resolve('success'),
    refreshCloudBackupStatus: action('refreshCloudBackupStatus'),
    refreshBackupSubscriptionStatus: action('refreshBackupSubscriptionStatus'),
    removeCustomColor: action('removeCustomColor'),
    removeCustomColorOnConversations: action(
      'removeCustomColorOnConversations'
    ),
    resumeBackupMediaDownload: action('resumeBackupMediaDownload'),
    pauseBackupMediaDownload: action('pauseBackupMediaDownload'),
    cancelBackupMediaDownload: action('cancelBackupMediaDownload'),
    resetAllChatColors: action('resetAllChatColors'),
    resetDefaultChatColor: action('resetDefaultChatColor'),
    savePreferredLeftPaneWidth: action('savePreferredLeftPaneWidth'),
    setGlobalDefaultConversationColor: action(
      'setGlobalDefaultConversationColor'
    ),
    setSettingsLocation: action('setSettingsLocation'),
    showToast: action('showToast'),
    validateBackup: async () => {
      return {
        result: validateBackupResult,
      };
    },
    donationReceipts: [],
    internalAddDonationReceipt: action('internalAddDonationReceipt'),
    saveAttachmentToDisk: async () => {
      action('saveAttachmentToDisk')();
      return { fullPath: '/mock/path/to/file.png', name: 'file.png' };
    },
    generateDonationReceiptBlob: async () => {
      action('generateDonationReceiptBlob')();
      return new Blob();
    },
    __dangerouslyRunAbitraryReadOnlySqlQuery: async () => {
      return Promise.resolve([]);
    },
  } satisfies PropsType,
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  const [settingsLocation, setSettingsLocation] = useState(
    args.settingsLocation
  );
  return (
    <Preferences
      {...args}
      settingsLocation={settingsLocation}
      setSettingsLocation={(newSettingsLocation: SettingsLocation) => {
        // eslint-disable-next-line no-console
        console.log('setSettingsLocation:', newSettingsLocation);
        setSettingsLocation(newSettingsLocation);
      }}
    />
  );
};

export const _Preferences = Template.bind({});

export const General = Template.bind({});
General.args = {
  settingsLocation: { page: SettingsPage.General },
};
export const Appearance = Template.bind({});
Appearance.args = {
  settingsLocation: { page: SettingsPage.Appearance },
};
export const Chats = Template.bind({});
Chats.args = {
  settingsLocation: { page: SettingsPage.Chats },
};
export const ChatFolders = Template.bind({});
ChatFolders.args = {
  settingsLocation: {
    page: SettingsPage.ChatFolders,
    previousLocation: null,
  },
};
export const EditChatFolder = Template.bind({});
EditChatFolder.args = {
  settingsLocation: {
    page: SettingsPage.EditChatFolder,
    chatFolderId: null,
    initChatFolderParams: null,
    previousLocation: null,
  },
};
export const Calls = Template.bind({});
Calls.args = {
  settingsLocation: { page: SettingsPage.Calls },
};
export const Notifications = Template.bind({});
Notifications.args = {
  settingsLocation: { page: SettingsPage.Notifications },
};
export const Privacy = Template.bind({});
Privacy.args = {
  settingsLocation: { page: SettingsPage.Privacy },
};
export const DataUsage = Template.bind({});
DataUsage.args = {
  settingsLocation: { page: SettingsPage.DataUsage },
};
export const Donations = Template.bind({});
Donations.args = {
  settingsLocation: { page: SettingsPage.Donations },
};

export const NotificationsPageWithThreeProfiles = Template.bind({});
const threeProfiles = [
  {
    id: 'Weekday' as NotificationProfileIdString,
    name: 'Weekday',
    emoji: '😬',
    color: 0xffe3e3fe,

    createdAtMs: Date.now(),

    allowAllCalls: true,
    allowAllMentions: true,

    allowedMembers: new Set([conversations[0].id, conversations[1].id]),
    scheduleEnabled: true,

    scheduleStartTime: 1800,
    scheduleEndTime: 2300,

    scheduleDaysEnabled: {
      [DayOfWeek.SUNDAY]: false,
      [DayOfWeek.MONDAY]: true,
      [DayOfWeek.TUESDAY]: true,
      [DayOfWeek.WEDNESDAY]: true,
      [DayOfWeek.THURSDAY]: true,
      [DayOfWeek.FRIDAY]: true,
      [DayOfWeek.SATURDAY]: false,
    },
    deletedAtTimestampMs: undefined,
    storageNeedsSync: true,
  },
  {
    id: 'Weekend' as NotificationProfileIdString,
    name: 'Weekend',
    emoji: '❤️‍🔥',
    color: 0xffd7d7d9,

    createdAtMs: Date.now(),

    allowAllCalls: true,
    allowAllMentions: true,

    allowedMembers: new Set([conversations[0].id, conversations[1].id]),
    scheduleEnabled: true,

    scheduleStartTime: 100,
    scheduleEndTime: 1200,

    scheduleDaysEnabled: {
      [DayOfWeek.SUNDAY]: true,
      [DayOfWeek.MONDAY]: false,
      [DayOfWeek.TUESDAY]: false,
      [DayOfWeek.WEDNESDAY]: false,
      [DayOfWeek.THURSDAY]: false,
      [DayOfWeek.FRIDAY]: false,
      [DayOfWeek.SATURDAY]: true,
    },
    deletedAtTimestampMs: undefined,
    storageNeedsSync: true,
  },
  {
    id: 'Random' as NotificationProfileIdString,
    name: 'Random',
    emoji: undefined,
    color: 0xfffef5d0,

    createdAtMs: Date.now(),

    allowAllCalls: true,
    allowAllMentions: true,

    allowedMembers: new Set([conversations[0].id, conversations[1].id]),
    scheduleEnabled: true,

    scheduleStartTime: 1800,
    scheduleEndTime: 2300,

    scheduleDaysEnabled: {
      [DayOfWeek.SUNDAY]: true,
      [DayOfWeek.MONDAY]: false,
      [DayOfWeek.TUESDAY]: true,
      [DayOfWeek.WEDNESDAY]: false,
      [DayOfWeek.THURSDAY]: true,
      [DayOfWeek.FRIDAY]: false,
      [DayOfWeek.SATURDAY]: true,
    },
    deletedAtTimestampMs: undefined,
    storageNeedsSync: true,
  },
];

NotificationsPageWithThreeProfiles.args = {
  settingsLocation: { page: SettingsPage.Notifications },
  notificationProfileCount: threeProfiles.length,
  renderNotificationProfilesCreateFlow: (
    props: SmartNotificationProfilesProps
  ) => {
    return (
      <NotificationProfilesCreateFlow
        contentsRef={props.contentsRef}
        conversations={conversations}
        conversationSelector={conversationSelector}
        createProfile={action('createProfile')}
        i18n={i18n}
        setSettingsLocation={props.setSettingsLocation}
        preferredBadgeSelector={() => undefined}
        theme={ThemeType.light}
      />
    );
  },
  renderNotificationProfilesHome: (props: SmartNotificationProfilesProps) => {
    return (
      <NotificationProfilesHome
        activeProfileId={threeProfiles[0].id}
        allProfiles={threeProfiles}
        contentsRef={props.contentsRef}
        conversations={conversations}
        conversationSelector={conversationSelector}
        hasOnboardingBeenSeen
        i18n={i18n}
        isSyncEnabled
        loading={false}
        markProfileDeleted={action('markProfileDeleted')}
        preferredBadgeSelector={() => undefined}
        setHasOnboardingBeenSeen={action('setHasOnboardingBeenSeen')}
        setIsSyncEnabled={action('setIsSyncEnabled')}
        setSettingsLocation={props.setSettingsLocation}
        setProfileOverride={action('setProfileOverride)')}
        theme={ThemeType.light}
        updateProfile={action('updateProfile')}
      />
    );
  },
};

export const DonationsDonateFlow = Template.bind({});
DonationsDonateFlow.args = {
  settingsLocation: { page: SettingsPage.DonationsDonateFlow },
  renderDonationsPane: ({
    contentsRef,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    settingsLocation: SettingsLocation;
    setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  }) =>
    renderDonationsPane({
      contentsRef,
      me,
      donationReceipts: [],
      settingsLocation: { page: SettingsPage.DonationsDonateFlow },
      setSettingsLocation: action('setSettingsLocation'),
      saveAttachmentToDisk: async () => {
        action('saveAttachmentToDisk')();
        return { fullPath: '/mock/path/to/file.png', name: 'file.png' };
      },
      generateDonationReceiptBlob: async () => {
        action('generateDonationReceiptBlob')();
        return new Blob();
      },
      showToast: action('showToast'),
    }),
};
export const DonationReceipts = Template.bind({});
DonationReceipts.args = {
  settingsLocation: { page: SettingsPage.DonationsDonateFlow },
  renderDonationsPane: ({
    contentsRef,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    settingsLocation: SettingsLocation;
    setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  }) =>
    renderDonationsPane({
      contentsRef,
      me,
      donationReceipts: [
        {
          id: '9f9288a1-acb6-4d2e-a4fe-0a736a318a26',
          currencyType: 'usd',
          paymentAmount: 1000,
          timestamp: 1754000413436,
        },
        {
          id: '22defee0-8797-4a49-bac8-1673232706fa',
          currencyType: 'jpy',
          paymentAmount: 1000,
          timestamp: 1753995255509,
        },
      ],
      settingsLocation: { page: SettingsPage.DonationsReceiptList },
      setSettingsLocation: action('setSettingsLocation'),
      saveAttachmentToDisk: async () => {
        action('saveAttachmentToDisk')();
        return { fullPath: '/mock/path/to/file.png', name: 'file.png' };
      },
      generateDonationReceiptBlob: async () => {
        action('generateDonationReceiptBlob')();
        return new Blob();
      },
      showToast: action('showToast'),
    }),
};
export const DonationsHomeWithInProgressDonation = Template.bind({});
DonationsHomeWithInProgressDonation.args = {
  settingsLocation: { page: SettingsPage.Donations },
  renderDonationsPane: ({
    contentsRef,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
  }) =>
    renderDonationsPane({
      contentsRef,
      me,
      donationReceipts: [],
      settingsLocation: { page: SettingsPage.Donations },
      setSettingsLocation: action('setSettingsLocation'),
      saveAttachmentToDisk: async () => {
        action('saveAttachmentToDisk')();
        return { fullPath: '/mock/path/to/file.png', name: 'file.png' };
      },
      generateDonationReceiptBlob: async () => {
        action('generateDonationReceiptBlob')();
        return new Blob();
      },
      showToast: action('showToast'),
      workflow: {
        type: 'INTENT_METHOD',
        timestamp: Date.now() - 60,
        paymentMethodId: 'a',
        paymentAmount: 500,
        currencyType: 'USD',
        clientSecret: 'a',
        paymentIntentId: 'a',
        id: 'a',
        returnToken: 'a',
      },
    }),
};
export const Internal = Template.bind({});
Internal.args = {
  settingsLocation: { page: SettingsPage.Internal },
  isInternalUser: true,
};

export const Blocked1 = Template.bind({});
Blocked1.args = {
  blockedCount: 1,
  settingsLocation: { page: SettingsPage.Privacy },
};

export const BlockedMany = Template.bind({});
BlockedMany.args = {
  blockedCount: 55,
  settingsLocation: { page: SettingsPage.Privacy },
};

export const CustomUniversalExpireTimer = Template.bind({});
CustomUniversalExpireTimer.args = {
  universalExpireTimer: DurationInSeconds.fromSeconds(9000),
  settingsLocation: { page: SettingsPage.Privacy },
};

export const PNPSharingDisabled = Template.bind({});
PNPSharingDisabled.args = {
  whoCanSeeMe: PhoneNumberSharingMode.Nobody,
  whoCanFindMe: PhoneNumberDiscoverability.Discoverable,
  settingsLocation: { page: SettingsPage.PNP },
};

export const PNPDiscoverabilityDisabled = Template.bind({});
PNPDiscoverabilityDisabled.args = {
  whoCanSeeMe: PhoneNumberSharingMode.Nobody,
  whoCanFindMe: PhoneNumberDiscoverability.NotDiscoverable,
  settingsLocation: { page: SettingsPage.PNP },
};

export const BackupDetailsMediaDownloadActive = Template.bind({});
BackupDetailsMediaDownloadActive.args = {
  settingsLocation: { page: SettingsPage.BackupsDetails },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
  backupTier: BackupLevel.Paid,
  backupSubscriptionStatus: {
    status: 'active',
    cost: {
      amount: 22.99,
      currencyCode: 'USD',
    },
    renewalTimestamp: Date.now() + 20 * DAY,
  },
  backupMediaDownloadStatus: {
    completedBytes: 123_456_789,
    totalBytes: 987_654_321,
    isPaused: false,
    isIdle: false,
  },
};
export const BackupDetailsMediaDownloadPaused = Template.bind({});
BackupDetailsMediaDownloadPaused.args = {
  settingsLocation: { page: SettingsPage.BackupsDetails },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
  backupTier: BackupLevel.Paid,
  backupSubscriptionStatus: {
    status: 'active',
    cost: {
      amount: 22.99,
      currencyCode: 'USD',
    },
    renewalTimestamp: Date.now() + 20 * DAY,
  },
  backupMediaDownloadStatus: {
    completedBytes: 123_456_789,
    totalBytes: 987_654_321,
    isPaused: true,
    isIdle: false,
  },
};

export const BackupDetailsFree = Template.bind({});
BackupDetailsFree.args = {
  settingsLocation: { page: SettingsPage.BackupsDetails },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
  backupTier: BackupLevel.Free,
  backupSubscriptionStatus: {
    status: 'not-found',
    lastFetchedAtMs: Date.now(),
  },
};

export const BackupsPaidActive = Template.bind({});
BackupsPaidActive.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupTier: BackupLevel.Paid,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
  backupSubscriptionStatus: {
    status: 'active',
    cost: {
      amount: 22.99,
      currencyCode: 'USD',
    },
    renewalTimestamp: Date.now() + 20 * DAY,
  },
};

export const BackupsPaidLoadingSubscription = Template.bind({});
BackupsPaidLoadingSubscription.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupTier: BackupLevel.Paid,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
  backupSubscriptionStatus: {
    status: 'active',
    cost: {
      amount: 22.99,
      currencyCode: 'USD',
    },
    renewalTimestamp: Date.now() + 20 * DAY,
    isFetching: true,
    lastFetchedAtMs: Date.now() - HOUR,
  },
};

export const BackupsPaidLoadingFirstTime = Template.bind({});
BackupsPaidLoadingFirstTime.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupTier: BackupLevel.Paid,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
  backupSubscriptionStatus: {
    status: 'not-found',
    isFetching: true,
  },
};

export const BackupsPaidCanceled = Template.bind({});
BackupsPaidCanceled.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupTier: BackupLevel.Paid,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
  backupSubscriptionStatus: {
    status: 'pending-cancellation',
    cost: {
      amount: 22.99,
      currencyCode: 'USD',
    },
    expiryTimestamp: Date.now() + 20 * DAY,
  },
};

export const BackupsFree = Template.bind({});
BackupsFree.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupTier: BackupLevel.Free,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
};
export const BackupsFreeNoLocal = Template.bind({});
BackupsFreeNoLocal.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: false,
  backupTier: BackupLevel.Free,
};

export const BackupsOff = Template.bind({});
BackupsOff.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupTier: null,
};

export const BackupsLocalBackups = Template.bind({});
BackupsLocalBackups.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
};

export const BackupsRemoteEnabledLocalDisabled = Template.bind({});
BackupsRemoteEnabledLocalDisabled.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: false,
};

export const BackupsPaidSubscriptionNotFound = Template.bind({});
BackupsPaidSubscriptionNotFound.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupSubscriptionStatus: {
    status: 'not-found',
  },
  backupTier: BackupLevel.Paid,
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
};

export const BackupsSubscriptionExpired = Template.bind({});
BackupsSubscriptionExpired.args = {
  settingsLocation: { page: SettingsPage.Backups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupTier: null,
  backupSubscriptionStatus: {
    status: 'expired',
  },
};

export const LocalBackups = Template.bind({});
LocalBackups.args = {
  settingsLocation: { page: SettingsPage.LocalBackups },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupKeyViewed: true,
  localBackupFolder: '/home/signaluser/Signal Backups/',
};

export const LocalBackupsSetupChooseFolder = Template.bind({});
LocalBackupsSetupChooseFolder.args = {
  settingsLocation: { page: SettingsPage.LocalBackupsSetupFolder },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
};

export const LocalBackupsSetupViewBackupKey = Template.bind({});
LocalBackupsSetupViewBackupKey.args = {
  settingsLocation: { page: SettingsPage.LocalBackupsSetupKey },
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  localBackupFolder: '/home/signaluser/Signal Backups/',
};

export const ShowingUpdateDialog = Template.bind({});
ShowingUpdateDialog.args = {
  shouldShowUpdateDialog: true,
};

export const NavTabsCollapsed = Template.bind({});
NavTabsCollapsed.args = {
  navTabsCollapsed: true,
};

export const NavTabsCollapsedWithBadges = Template.bind({});
NavTabsCollapsedWithBadges.args = {
  navTabsCollapsed: true,
  hasFailedStorySends: false,
  otherTabsUnreadStats: {
    unreadCount: 1,
    unreadMentionsCount: 2,
    readChatsMarkedUnreadCount: 0,
  },
};

export const NavTabsCollapsedWithExclamation = Template.bind({});
NavTabsCollapsedWithExclamation.args = {
  navTabsCollapsed: true,
  hasFailedStorySends: true,
  otherTabsUnreadStats: {
    unreadCount: 1,
    unreadMentionsCount: 2,
    readChatsMarkedUnreadCount: 0,
  },
};
