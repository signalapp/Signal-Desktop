// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';
import type { MutableRefObject } from 'react';

import { action } from '@storybook/addon-actions';
import { shuffle } from 'lodash';
import { Preferences } from './Preferences';
import { DEFAULT_CONVERSATION_COLOR } from '../types/Colors';
import { PhoneNumberSharingMode } from '../util/phoneNumberSharingMode';
import { PhoneNumberDiscoverability } from '../util/phoneNumberDiscoverability';
import { EmojiSkinTone } from './fun/data/emojis';
import { DAY, DurationInSeconds, WEEK } from '../util/durations';
import { DialogUpdate } from './DialogUpdate';
import { DialogType } from '../types/Dialogs';
import { ThemeType } from '../types/Util';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-helpers/getDefaultConversation';
import { ProfileEditor } from './ProfileEditor';
import {
  UsernameEditState,
  UsernameLinkState,
} from '../state/ducks/usernameEnums';
import { ProfileEditorPage, SettingsPage } from '../types/Nav';
import { PreferencesDonations } from './PreferencesDonations';
import { strictAssert } from '../util/assert';

import type { LocalizerType } from '../types/Util';
import type { PropsType } from './Preferences';
import type { WidthBreakpoint } from './_util';
import type { MessageAttributesType } from '../model-types';
import type {
  DonationReceipt,
  OneTimeDonationHumanAmounts,
} from '../types/Donations';
import type { AnyToast } from '../types/Toast';

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
      onEmojiSkinToneDefaultChange={action('onEmojiSkinToneDefaultChange')}
      openUsernameReservationModal={action('openUsernameReservationModal')}
      profileAvatarUrl={undefined}
      recentEmojis={[]}
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
  page: SettingsPage;
  setPage: (page: SettingsPage) => void;
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
}): JSX.Element {
  return (
    <PreferencesDonations
      i18n={i18n}
      contentsRef={props.contentsRef}
      clearWorkflow={action('clearWorkflow')}
      initialCurrency="usd"
      resumeWorkflow={action('resumeWorkflow')}
      isOnline
      isStaging
      page={props.page}
      setPage={props.setPage}
      submitDonation={action('submitDonation')}
      lastError={undefined}
      workflow={undefined}
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
    />
  );
}

function renderToastManager(): JSX.Element {
  return <div />;
}

export default {
  title: 'Components/Preferences',
  component: Preferences,
  args: {
    i18n,

    conversations,
    conversationSelector,

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
    backupKeyViewed: false,
    backupLocalBackupsEnabled: false,
    backupSubscriptionStatus: { status: 'off' },
    badge: undefined,
    blockedCount: 0,
    customColors: {},
    defaultConversationColor: DEFAULT_CONVERSATION_COLOR,
    deviceName: 'Work Windows ME',
    donationsFeatureEnabled: false,
    emojiSkinToneDefault: EmojiSkinTone.None,
    phoneNumber: '+1 555 123-4567',
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
    otherTabsUnreadStats: {
      unreadCount: 0,
      unreadMentionsCount: 0,
      markedUnread: false,
    },
    page: SettingsPage.Profile,
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
      page,
      setPage,
    }: {
      contentsRef: MutableRefObject<HTMLDivElement | null>;
      page: SettingsPage;
      setPage: (page: SettingsPage) => void;
    }) =>
      renderDonationsPane({
        contentsRef,
        page,
        setPage,
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
    renderProfileEditor,
    renderToastManager,
    renderUpdateDialog,
    getConversationsWithCustomColor: () => [],
    getPreferredBadge: () => undefined,

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
    setPage: action('setPage'),
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
  } satisfies PropsType,
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  const [page, setPage] = useState(args.page);
  return (
    <Preferences
      {...args}
      page={page}
      setPage={(
        newPage: SettingsPage,
        profilePage: ProfileEditorPage | undefined
      ) => {
        // eslint-disable-next-line no-console
        console.log('setPage:', newPage, profilePage);
        setPage(newPage);
      }}
    />
  );
};

export const _Preferences = Template.bind({});

export const General = Template.bind({});
General.args = {
  page: SettingsPage.General,
};
export const Appearance = Template.bind({});
Appearance.args = {
  page: SettingsPage.Appearance,
};
export const Chats = Template.bind({});
Chats.args = {
  page: SettingsPage.Chats,
};
export const ChatFolders = Template.bind({});
ChatFolders.args = {
  page: SettingsPage.ChatFolders,
};
export const EditChatFolder = Template.bind({});
EditChatFolder.args = {
  page: SettingsPage.EditChatFolder,
};
export const Calls = Template.bind({});
Calls.args = {
  page: SettingsPage.Calls,
};
export const Notifications = Template.bind({});
Notifications.args = {
  page: SettingsPage.Notifications,
};
export const Privacy = Template.bind({});
Privacy.args = {
  page: SettingsPage.Privacy,
};
export const DataUsage = Template.bind({});
DataUsage.args = {
  page: SettingsPage.DataUsage,
};
export const Donations = Template.bind({});
Donations.args = {
  donationsFeatureEnabled: true,
  page: SettingsPage.Donations,
};
export const DonationsDonateFlow = Template.bind({});
DonationsDonateFlow.args = {
  donationsFeatureEnabled: true,
  page: SettingsPage.DonationsDonateFlow,
  renderDonationsPane: ({
    contentsRef,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    page: SettingsPage;
    setPage: (page: SettingsPage) => void;
  }) =>
    renderDonationsPane({
      contentsRef,
      me,
      donationReceipts: [],
      page: SettingsPage.DonationsDonateFlow,
      setPage: action('setPage'),
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
  donationsFeatureEnabled: true,
  page: SettingsPage.DonationsDonateFlow,
  renderDonationsPane: ({
    contentsRef,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    page: SettingsPage;
    setPage: (page: SettingsPage) => void;
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
      page: SettingsPage.DonationsReceiptList,
      setPage: action('setPage'),
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
export const Internal = Template.bind({});
Internal.args = {
  page: SettingsPage.Internal,
  isInternalUser: true,
};

export const Blocked1 = Template.bind({});
Blocked1.args = {
  blockedCount: 1,
  page: SettingsPage.Privacy,
};

export const BlockedMany = Template.bind({});
BlockedMany.args = {
  blockedCount: 55,
  page: SettingsPage.Privacy,
};

export const CustomUniversalExpireTimer = Template.bind({});
CustomUniversalExpireTimer.args = {
  universalExpireTimer: DurationInSeconds.fromSeconds(9000),
  page: SettingsPage.Privacy,
};

export const PNPSharingDisabled = Template.bind({});
PNPSharingDisabled.args = {
  whoCanSeeMe: PhoneNumberSharingMode.Nobody,
  whoCanFindMe: PhoneNumberDiscoverability.Discoverable,
  page: SettingsPage.PNP,
};

export const PNPDiscoverabilityDisabled = Template.bind({});
PNPDiscoverabilityDisabled.args = {
  whoCanSeeMe: PhoneNumberSharingMode.Nobody,
  whoCanFindMe: PhoneNumberDiscoverability.NotDiscoverable,
  page: SettingsPage.PNP,
};

export const BackupsMediaDownloadActive = Template.bind({});
BackupsMediaDownloadActive.args = {
  page: SettingsPage.BackupsDetails,
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
  backupMediaDownloadStatus: {
    completedBytes: 123_456_789,
    totalBytes: 987_654_321,
    isPaused: false,
    isIdle: false,
  },
};
export const BackupsMediaDownloadPaused = Template.bind({});
BackupsMediaDownloadPaused.args = {
  page: SettingsPage.BackupsDetails,
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
  backupMediaDownloadStatus: {
    completedBytes: 123_456_789,
    totalBytes: 987_654_321,
    isPaused: true,
    isIdle: false,
  },
};

export const BackupsPaidActive = Template.bind({});
BackupsPaidActive.args = {
  page: SettingsPage.Backups,
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

export const BackupsPaidCanceled = Template.bind({});
BackupsPaidCanceled.args = {
  page: SettingsPage.Backups,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
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
  page: SettingsPage.Backups,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupSubscriptionStatus: {
    status: 'free',
    mediaIncludedInBackupDurationDays: 30,
  },
};

export const BackupsOff = Template.bind({});
BackupsOff.args = {
  page: SettingsPage.Backups,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
};

export const BackupsLocalBackups = Template.bind({});
BackupsLocalBackups.args = {
  page: SettingsPage.Backups,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
};

export const BackupsSubscriptionNotFound = Template.bind({});
BackupsSubscriptionNotFound.args = {
  page: SettingsPage.Backups,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupSubscriptionStatus: {
    status: 'not-found',
  },
  cloudBackupStatus: {
    protoSize: 100_000_000,
    createdTimestamp: Date.now() - WEEK,
  },
};

export const BackupsSubscriptionExpired = Template.bind({});
BackupsSubscriptionExpired.args = {
  page: SettingsPage.Backups,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupSubscriptionStatus: {
    status: 'expired',
  },
};

export const LocalBackups = Template.bind({});
LocalBackups.args = {
  page: SettingsPage.LocalBackups,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
  backupKeyViewed: true,
  localBackupFolder: '/home/signaluser/Signal Backups/',
};

export const LocalBackupsSetupChooseFolder = Template.bind({});
LocalBackupsSetupChooseFolder.args = {
  page: SettingsPage.LocalBackupsSetupFolder,
  backupFeatureEnabled: true,
  backupLocalBackupsEnabled: true,
};

export const LocalBackupsSetupViewBackupKey = Template.bind({});
LocalBackupsSetupViewBackupKey.args = {
  page: SettingsPage.LocalBackupsSetupKey,
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
    markedUnread: false,
  },
};

export const NavTabsCollapsedWithExclamation = Template.bind({});
NavTabsCollapsedWithExclamation.args = {
  navTabsCollapsed: true,
  hasFailedStorySends: true,
  otherTabsUnreadStats: {
    unreadCount: 1,
    unreadMentionsCount: 2,
    markedUnread: true,
  },
};

export const WithDonationsEnabled = Template.bind({});
WithDonationsEnabled.args = {
  donationsFeatureEnabled: true,
};
