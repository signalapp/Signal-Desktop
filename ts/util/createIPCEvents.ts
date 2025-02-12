// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type { AudioDevice } from '@signalapp/ringrtc';
import { noop } from 'lodash';

import type { ZoomFactorType } from '../types/Storage.d';
import type {
  ConversationColorType,
  CustomColorType,
  DefaultConversationColorType,
} from '../types/Colors';
import { DEFAULT_CONVERSATION_COLOR } from '../types/Colors';
import * as Errors from '../types/errors';
import * as Stickers from '../types/Stickers';

import type { ConversationType } from '../state/ducks/conversations';
import { calling } from '../services/calling';
import { resolveUsernameByLinkBase64 } from '../services/username';
import { writeProfile } from '../services/writeProfile';
import { isInCall } from '../state/selectors/calling';
import { getConversationsWithCustomColorSelector } from '../state/selectors/conversations';
import { getCustomColors } from '../state/selectors/items';
import { themeChanged } from '../shims/themeChanged';
import { renderClearingDataView } from '../shims/renderClearingDataView';

import * as universalExpireTimer from './universalExpireTimer';
import { PhoneNumberDiscoverability } from './phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from './phoneNumberSharingMode';
import { strictAssert, assertDev } from './assert';
import * as durations from './durations';
import type { DurationInSeconds } from './durations';
import * as Registration from './registration';
import { lookupConversationWithoutServiceId } from './lookupConversationWithoutServiceId';
import * as log from '../logging/log';
import { deleteAllMyStories } from './deleteAllMyStories';
import {
  type NotificationClickData,
  notificationService,
} from '../services/notifications';
import { StoryViewModeType, StoryViewTargetType } from '../types/Stories';
import { isValidE164 } from './isValidE164';
import { fromWebSafeBase64 } from './webSafeBase64';
import { getConversation } from './getConversation';
import { instance, PhoneNumberFormat } from './libphonenumberInstance';
import { showConfirmationDialog } from './showConfirmationDialog';
import type {
  EphemeralSettings,
  SettingsValuesType,
  ThemeType,
} from './preload';
import type { SystemTraySetting } from '../types/SystemTraySetting';
import { drop } from './drop';
import { sendSyncRequests } from '../textsecure/syncRequests';

type SentMediaQualityType = 'standard' | 'high';
type NotificationSettingType = 'message' | 'name' | 'count' | 'off';

export type IPCEventsValuesType = {
  alwaysRelayCalls: boolean | undefined;
  audioNotification: boolean | undefined;
  audioMessage: boolean;
  autoConvertEmoji: boolean;
  autoDownloadUpdate: boolean;
  autoLaunch: boolean;
  callRingtoneNotification: boolean;
  callSystemNotification: boolean;
  countMutedConversations: boolean;
  hasStoriesDisabled: boolean;
  hideMenuBar: boolean | undefined;
  incomingCallNotification: boolean;
  lastSyncTime: number | undefined;
  notificationDrawAttention: boolean;
  notificationSetting: NotificationSettingType;
  preferredAudioInputDevice: AudioDevice | undefined;
  preferredAudioOutputDevice: AudioDevice | undefined;
  preferredVideoInputDevice: string | undefined;
  sentMediaQualitySetting: SentMediaQualityType;
  textFormatting: boolean;
  universalExpireTimer: DurationInSeconds;
  zoomFactor: ZoomFactorType;
  storyViewReceiptsEnabled: boolean;

  // Optional
  mediaPermissions: boolean;
  mediaCameraPermissions: boolean;

  // Only getters

  blockedCount: number;
  linkPreviewSetting: boolean;
  phoneNumberDiscoverabilitySetting: PhoneNumberDiscoverability;
  phoneNumberSharingSetting: PhoneNumberSharingMode;
  readReceiptSetting: boolean;
  typingIndicatorSetting: boolean;
  deviceName: string | undefined;
  phoneNumber: string | undefined;
};

export type IPCEventsCallbacksType = {
  getAvailableIODevices(): Promise<{
    availableCameras: Array<
      Pick<MediaDeviceInfo, 'deviceId' | 'groupId' | 'kind' | 'label'>
    >;
    availableMicrophones: Array<AudioDevice>;
    availableSpeakers: Array<AudioDevice>;
  }>;
  addCustomColor: (customColor: CustomColorType) => void;
  addDarkOverlay: () => void;
  cleanupDownloads: () => Promise<void>;
  deleteAllData: () => Promise<void>;
  deleteAllMyStories: () => Promise<void>;
  editCustomColor: (colorId: string, customColor: CustomColorType) => void;
  getConversationsWithCustomColor: (x: string) => Array<ConversationType>;
  getMediaAccessStatus: (
    mediaType: 'screen' | 'microphone' | 'camera'
  ) => Promise<string | unknown>;
  installStickerPack: (packId: string, key: string) => Promise<void>;
  isPrimary: () => boolean;
  removeCustomColor: (x: string) => void;
  removeCustomColorOnConversations: (x: string) => void;
  removeDarkOverlay: () => void;
  resetAllChatColors: () => void;
  resetDefaultChatColor: () => void;
  setMediaPlaybackDisabled: (playbackDisabled: boolean) => void;
  showConversationViaNotification: (data: NotificationClickData) => void;
  showConversationViaToken: (token: string) => void;
  showConversationViaSignalDotMe: (
    kind: string,
    value: string
  ) => Promise<void>;
  showKeyboardShortcuts: () => void;
  showGroupViaLink: (value: string) => Promise<void>;
  showReleaseNotes: () => void;
  showStickerPack: (packId: string, key: string) => void;
  startCallingLobbyViaToken: (token: string) => void;
  requestCloseConfirmation: () => Promise<boolean>;
  getIsInCall: () => boolean;
  shutdown: () => Promise<void>;
  unknownSignalLink: () => void;
  getCustomColors: () => Record<string, CustomColorType>;
  syncRequest: () => Promise<void>;
  setGlobalDefaultConversationColor: (
    color: ConversationColorType,
    customColor?: { id: string; value: CustomColorType }
  ) => void;
  getDefaultConversationColor: () => DefaultConversationColorType;
  uploadStickerPack: (
    manifest: Uint8Array,
    stickers: ReadonlyArray<Uint8Array>
  ) => Promise<string>;
};

type ValuesWithGetters = Omit<
  SettingsValuesType,
  // Async
  | 'zoomFactor'
  | 'localeOverride'
  | 'spellCheck'
  | 'themeSetting'
  // Optional
  | 'mediaPermissions'
  | 'mediaCameraPermissions'
  | 'autoLaunch'
  | 'systemTraySetting'
>;

type ValuesWithSetters = Omit<
  SettingsValuesType,
  | 'blockedCount'
  | 'defaultConversationColor'
  | 'linkPreviewSetting'
  | 'readReceiptSetting'
  | 'typingIndicatorSetting'
  | 'deviceName'
  | 'phoneNumber'

  // Optional
  | 'mediaPermissions'
  | 'mediaCameraPermissions'

  // Only set in the Settings window
  | 'localeOverride'
  | 'spellCheck'
  | 'systemTraySetting'
>;

export type IPCEventsUpdatersType = {
  [Key in keyof EphemeralSettings as IPCEventUpdaterType<Key>]?: (
    value: EphemeralSettings[Key]
  ) => void;
};

export type IPCEventGetterType<Key extends keyof SettingsValuesType> =
  `get${Capitalize<Key>}`;

export type IPCEventSetterType<Key extends keyof SettingsValuesType> =
  `set${Capitalize<Key>}`;

export type IPCEventUpdaterType<Key extends keyof SettingsValuesType> =
  `update${Capitalize<Key>}`;

export type IPCEventsGettersType = {
  [Key in keyof ValuesWithGetters as IPCEventGetterType<Key>]: () => ValuesWithGetters[Key];
} & {
  // Async
  getZoomFactor: () => Promise<ZoomFactorType>;
  getLocaleOverride: () => Promise<string | null>;
  getSpellCheck: () => Promise<boolean>;
  getSystemTraySetting: () => Promise<SystemTraySetting>;
  getThemeSetting: () => Promise<ThemeType>;
  // Events
  onZoomFactorChange: (callback: (zoomFactor: ZoomFactorType) => void) => void;
  // Optional
  getMediaPermissions?: () => Promise<boolean>;
  getMediaCameraPermissions?: () => Promise<boolean>;
  getAutoLaunch?: () => Promise<boolean>;
};

export type IPCEventsSettersType = {
  [Key in keyof ValuesWithSetters as IPCEventSetterType<Key>]: (
    value: NonNullable<ValuesWithSetters[Key]>
  ) => Promise<void>;
} & {
  setMediaPermissions?: (value: boolean) => Promise<void>;
  setMediaCameraPermissions?: (value: boolean) => Promise<void>;
};

export type IPCEventsType = IPCEventsGettersType &
  IPCEventsSettersType &
  IPCEventsUpdatersType &
  IPCEventsCallbacksType;

export function createIPCEvents(
  overrideEvents: Partial<IPCEventsType> = {}
): IPCEventsType {
  const setPhoneNumberDiscoverabilitySetting = async (
    newValue: PhoneNumberDiscoverability
  ): Promise<void> => {
    strictAssert(window.textsecure.server, 'WebAPI must be available');
    await window.storage.put('phoneNumberDiscoverability', newValue);
    await window.textsecure.server.setPhoneNumberDiscoverability(
      newValue === PhoneNumberDiscoverability.Discoverable
    );
    const account = window.ConversationController.getOurConversationOrThrow();
    account.captureChange('phoneNumberDiscoverability');
  };

  return {
    getDeviceName: () => window.textsecure.storage.user.getDeviceName(),
    getPhoneNumber: () => {
      try {
        const e164 = window.textsecure.storage.user.getNumber();
        const parsedNumber = instance.parse(e164);
        return instance.format(parsedNumber, PhoneNumberFormat.INTERNATIONAL);
      } catch (error) {
        log.warn(
          'IPC.getPhoneNumber: failed to parse our E164',
          Errors.toLogFormat(error)
        );
        return '';
      }
    },

    getZoomFactor: () => {
      return ipcRenderer.invoke('getZoomFactor');
    },
    setZoomFactor: async zoomFactor => {
      ipcRenderer.send('setZoomFactor', zoomFactor);
    },
    onZoomFactorChange: callback => {
      ipcRenderer.on('zoomFactorChanged', (_event, zoomFactor) => {
        callback(zoomFactor);
      });
    },

    setPhoneNumberDiscoverabilitySetting,
    setPhoneNumberSharingSetting: async (newValue: PhoneNumberSharingMode) => {
      const account = window.ConversationController.getOurConversationOrThrow();

      const promises = new Array<Promise<void>>();
      promises.push(window.storage.put('phoneNumberSharingMode', newValue));
      if (newValue === PhoneNumberSharingMode.Everybody) {
        promises.push(
          setPhoneNumberDiscoverabilitySetting(
            PhoneNumberDiscoverability.Discoverable
          )
        );
      }
      account.captureChange('phoneNumberSharingMode');
      await Promise.all(promises);

      // Write profile after updating storage so that the write has up-to-date
      // information.
      await writeProfile(getConversation(account), {
        keepAvatar: true,
      });
    },

    getHasStoriesDisabled: () =>
      window.storage.get('hasStoriesDisabled', false),
    setHasStoriesDisabled: async (value: boolean) => {
      await window.storage.put('hasStoriesDisabled', value);
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('hasStoriesDisabled');
      window.textsecure.server?.onHasStoriesDisabledChange(value);
    },
    getStoryViewReceiptsEnabled: () => {
      return (
        window.storage.get('storyViewReceiptsEnabled') ??
        window.storage.get('read-receipt-setting') ??
        false
      );
    },
    setStoryViewReceiptsEnabled: async (value: boolean) => {
      await window.storage.put('storyViewReceiptsEnabled', value);
      const account = window.ConversationController.getOurConversationOrThrow();
      account.captureChange('storyViewReceiptsEnabled');
    },

    getPreferredAudioInputDevice: () =>
      window.storage.get('preferred-audio-input-device'),
    setPreferredAudioInputDevice: device =>
      window.storage.put('preferred-audio-input-device', device),
    getPreferredAudioOutputDevice: () =>
      window.storage.get('preferred-audio-output-device'),
    setPreferredAudioOutputDevice: device =>
      window.storage.put('preferred-audio-output-device', device),
    getPreferredVideoInputDevice: () =>
      window.storage.get('preferred-video-input-device'),
    setPreferredVideoInputDevice: device =>
      window.storage.put('preferred-video-input-device', device),

    deleteAllMyStories: async () => {
      await deleteAllMyStories();
    },

    // Chat Color redux hookups
    getCustomColors: () => {
      return getCustomColors(window.reduxStore.getState()) || {};
    },
    getConversationsWithCustomColor: colorId => {
      return getConversationsWithCustomColorSelector(
        window.reduxStore.getState()
      )(colorId);
    },
    addCustomColor: (...args) =>
      window.reduxActions.items.addCustomColor(...args),
    editCustomColor: (...args) =>
      window.reduxActions.items.editCustomColor(...args),
    removeCustomColor: colorId =>
      window.reduxActions.items.removeCustomColor(colorId),
    removeCustomColorOnConversations: colorId =>
      window.reduxActions.conversations.removeCustomColorOnConversations(
        colorId
      ),
    resetAllChatColors: () =>
      window.reduxActions.conversations.resetAllChatColors(),
    resetDefaultChatColor: () =>
      window.reduxActions.items.resetDefaultChatColor(),
    setGlobalDefaultConversationColor: (...args) =>
      window.reduxActions.items.setGlobalDefaultConversationColor(...args),

    // Getters only
    getAvailableIODevices: async () => {
      const { availableCameras, availableMicrophones, availableSpeakers } =
        await calling.getAvailableIODevices();

      return {
        // mapping it to a pojo so that it is IPC friendly
        availableCameras: availableCameras.map(
          (inputDeviceInfo: MediaDeviceInfo) => ({
            deviceId: inputDeviceInfo.deviceId,
            groupId: inputDeviceInfo.groupId,
            kind: inputDeviceInfo.kind,
            label: inputDeviceInfo.label,
          })
        ),
        availableMicrophones,
        availableSpeakers,
      };
    },
    getBlockedCount: () =>
      window.storage.blocked.getBlockedServiceIds().length +
      window.storage.blocked.getBlockedGroups().length,
    getDefaultConversationColor: () =>
      window.storage.get(
        'defaultConversationColor',
        DEFAULT_CONVERSATION_COLOR
      ),
    getLinkPreviewSetting: () => window.storage.get('linkPreviews', false),
    getPhoneNumberDiscoverabilitySetting: () =>
      window.storage.get(
        'phoneNumberDiscoverability',
        PhoneNumberDiscoverability.NotDiscoverable
      ),
    getPhoneNumberSharingSetting: () =>
      window.storage.get(
        'phoneNumberSharingMode',
        PhoneNumberSharingMode.Nobody
      ),
    getReadReceiptSetting: () =>
      window.storage.get('read-receipt-setting', false),
    getTypingIndicatorSetting: () =>
      window.storage.get('typingIndicators', false),

    // Configurable settings
    getAutoDownloadUpdate: () =>
      window.storage.get('auto-download-update', true),
    setAutoDownloadUpdate: value =>
      window.storage.put('auto-download-update', value),
    getAutoConvertEmoji: () => window.storage.get('autoConvertEmoji', true),
    setAutoConvertEmoji: value => window.storage.put('autoConvertEmoji', value),
    getSentMediaQualitySetting: () =>
      window.storage.get('sent-media-quality', 'standard'),
    setSentMediaQualitySetting: value =>
      window.storage.put('sent-media-quality', value),
    getThemeSetting: async () => {
      return getEphemeralSetting('themeSetting') ?? null;
    },
    setThemeSetting: async value => {
      drop(setEphemeralSetting('themeSetting', value));
    },
    updateThemeSetting: _theme => {
      drop(themeChanged());
    },
    getHideMenuBar: () => window.storage.get('hide-menu-bar'),
    setHideMenuBar: value => {
      const promise = window.storage.put('hide-menu-bar', value);
      window.IPC.setAutoHideMenuBar(value);
      window.IPC.setMenuBarVisibility(!value);
      return promise;
    },
    getSystemTraySetting: () => getEphemeralSetting('systemTraySetting'),
    getLocaleOverride: async () => {
      return getEphemeralSetting('localeOverride') ?? null;
    },
    getNotificationSetting: () =>
      window.storage.get('notification-setting', 'message'),
    setNotificationSetting: (value: 'message' | 'name' | 'count' | 'off') =>
      window.storage.put('notification-setting', value),
    getNotificationDrawAttention: () =>
      window.storage.get('notification-draw-attention', false),
    setNotificationDrawAttention: value =>
      window.storage.put('notification-draw-attention', value),
    getAudioMessage: () => window.storage.get('audioMessage', false),
    setAudioMessage: value => window.storage.put('audioMessage', value),
    getAudioNotification: () => window.storage.get('audio-notification'),
    setAudioNotification: value =>
      window.storage.put('audio-notification', value),
    getCountMutedConversations: () =>
      window.storage.get('badge-count-muted-conversations', false),
    setCountMutedConversations: value => {
      const promise = window.storage.put(
        'badge-count-muted-conversations',
        value
      );
      window.Whisper.events.trigger('updateUnreadCount');
      return promise;
    },
    getCallRingtoneNotification: () =>
      window.storage.get('call-ringtone-notification', true),
    setCallRingtoneNotification: value =>
      window.storage.put('call-ringtone-notification', value),
    getCallSystemNotification: () =>
      window.storage.get('call-system-notification', true),
    setCallSystemNotification: value =>
      window.storage.put('call-system-notification', value),
    getIncomingCallNotification: () =>
      window.storage.get('incoming-call-notification', true),
    setIncomingCallNotification: value =>
      window.storage.put('incoming-call-notification', value),

    getSpellCheck: () => {
      return getEphemeralSetting('spellCheck');
    },
    getTextFormatting: () => window.storage.get('textFormatting', true),
    setTextFormatting: value => window.storage.put('textFormatting', value),

    getAlwaysRelayCalls: () => window.storage.get('always-relay-calls'),
    setAlwaysRelayCalls: value =>
      window.storage.put('always-relay-calls', value),

    getAutoLaunch: () => window.IPC.getAutoLaunch(),
    setAutoLaunch: async (value: boolean) => {
      return window.IPC.setAutoLaunch(value);
    },

    isPrimary: () => window.textsecure.storage.user.getDeviceId() === 1,
    syncRequest: async () => {
      const { contactSyncComplete } = await sendSyncRequests(
        5 * durations.MINUTE
      );
      return contactSyncComplete;
    },
    getLastSyncTime: () => window.storage.get('synced_at'),
    setLastSyncTime: value => window.storage.put('synced_at', value),
    getUniversalExpireTimer: () => universalExpireTimer.get(),
    setUniversalExpireTimer: async newValue => {
      await universalExpireTimer.set(newValue);

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
    },

    addDarkOverlay: () => {
      const elems = document.querySelectorAll('.dark-overlay');
      if (elems.length) {
        return;
      }
      const newOverlay = document.createElement('div');
      newOverlay.className = 'dark-overlay';
      newOverlay.addEventListener('click', () => {
        newOverlay.remove();
      });
      document.body.prepend(newOverlay);
    },
    removeDarkOverlay: () => {
      const elems = document.querySelectorAll('.dark-overlay');

      for (const elem of elems) {
        elem.remove();
      }
    },
    showKeyboardShortcuts: () =>
      window.reduxActions.globalModals.showShortcutGuideModal(),

    cleanupDownloads: async () => {
      await ipcRenderer.invoke('cleanup-downloads');
    },

    deleteAllData: async () => {
      renderClearingDataView();
    },

    showStickerPack: (packId, key) => {
      // We can get these events even if the user has never linked this instance.
      if (!Registration.everDone()) {
        log.warn('showStickerPack: Not registered, returning early');
        return;
      }
      window.reduxActions.globalModals.showStickerPackPreview(packId, key);
    },
    showGroupViaLink: async value => {
      // We can get these events even if the user has never linked this instance.
      if (!Registration.everDone()) {
        log.warn('showGroupViaLink: Not registered, returning early');
        return;
      }
      try {
        await window.Signal.Groups.joinViaLink(value);
      } catch (error) {
        log.error(
          'showGroupViaLink: Ran into an error!',
          Errors.toLogFormat(error)
        );
        window.reduxActions.globalModals.showErrorModal({
          title: window.i18n('icu:GroupV2--join--general-join-failure--title'),
          description: window.i18n('icu:GroupV2--join--general-join-failure'),
        });
      }
    },

    showConversationViaNotification({
      conversationId,
      messageId,
      storyId,
    }: NotificationClickData) {
      if (!conversationId) {
        window.reduxActions.app.openInbox();
      } else if (storyId) {
        window.reduxActions.stories.viewStory({
          storyId,
          storyViewMode: StoryViewModeType.Single,
          viewTarget: StoryViewTargetType.Replies,
        });
      } else {
        window.reduxActions.conversations.showConversation({
          conversationId,
          messageId: messageId ?? undefined,
        });
      }
    },

    showConversationViaToken(token: string) {
      const data = notificationService.resolveToken(token);
      if (!data) {
        window.reduxActions.app.openInbox();
      } else {
        window.Events.showConversationViaNotification(data);
      }
    },

    async showConversationViaSignalDotMe(kind: string, value: string) {
      if (!Registration.everDone()) {
        log.info(
          'showConversationViaSignalDotMe: Not registered, returning early'
        );
        return;
      }

      const { showUserNotFoundModal } = window.reduxActions.globalModals;

      let conversationId: string | undefined;

      if (kind === 'phoneNumber') {
        if (isValidE164(value, true)) {
          conversationId = await lookupConversationWithoutServiceId({
            type: 'e164',
            e164: value,
            phoneNumber: value,
            showUserNotFoundModal,
            setIsFetchingUUID: noop,
          });
        }
      } else if (kind === 'encryptedUsername') {
        const usernameBase64 = fromWebSafeBase64(value);
        const username = await resolveUsernameByLinkBase64(usernameBase64);
        if (username != null) {
          conversationId = await lookupConversationWithoutServiceId({
            type: 'username',
            username,
            showUserNotFoundModal,
            setIsFetchingUUID: noop,
          });
        }
      }

      if (conversationId != null) {
        window.reduxActions.conversations.showConversation({
          conversationId,
        });
        return;
      }

      log.info('showConversationViaSignalDotMe: invalid E164');
      showUnknownSgnlLinkModal();
    },

    startCallingLobbyViaToken(token: string) {
      const data = notificationService.resolveToken(token);
      if (!data) {
        return;
      }
      window.reduxActions?.calling?.startCallingLobby({
        conversationId: data.conversationId,
        isVideoCall: true,
      });
    },

    requestCloseConfirmation: async (): Promise<boolean> => {
      try {
        await new Promise<void>((resolve, reject) => {
          showConfirmationDialog({
            dialogName: 'closeConfirmation',
            onTopOfEverything: true,
            cancelText: window.i18n(
              'icu:ConfirmationDialog__Title--close-requested-not-now'
            ),
            confirmStyle: 'negative',
            title: window.i18n(
              'icu:ConfirmationDialog__Title--in-call-close-requested'
            ),
            okText: window.i18n('icu:close'),
            reject: () => reject(),
            resolve: () => resolve(),
          });
        });
        log.info('requestCloseConfirmation: Close confirmed by user.');
        window.reduxActions.calling.hangUpActiveCall(
          'User confirmed in-call close.'
        );

        return true;
      } catch {
        log.info('requestCloseConfirmation: Close cancelled by user.');
        return false;
      }
    },

    getIsInCall: (): boolean => {
      return isInCall(window.reduxStore.getState());
    },

    unknownSignalLink: () => {
      log.warn('unknownSignalLink: Showing error dialog');
      showUnknownSgnlLinkModal();
    },

    installStickerPack: async (packId, key) => {
      void Stickers.downloadStickerPack(packId, key, {
        finalStatus: 'installed',
        actionSource: 'ui',
      });
    },

    shutdown: () => Promise.resolve(),
    showReleaseNotes: () => {
      const { showWhatsNewModal } = window.reduxActions.globalModals;
      showWhatsNewModal();
    },

    getMediaAccessStatus: async (
      mediaType: 'screen' | 'microphone' | 'camera'
    ) => {
      return window.IPC.getMediaAccessStatus(mediaType);
    },
    getMediaPermissions: window.IPC.getMediaPermissions,
    getMediaCameraPermissions: window.IPC.getMediaCameraPermissions,

    setMediaPlaybackDisabled: (playbackDisabled: boolean) => {
      window.reduxActions?.lightbox.setPlaybackDisabled(playbackDisabled);
      if (playbackDisabled) {
        window.reduxActions?.audioPlayer.pauseVoiceNotePlayer();
      }
    },

    uploadStickerPack: (
      manifest: Uint8Array,
      stickers: ReadonlyArray<Uint8Array>
    ): Promise<string> => {
      strictAssert(window.textsecure.server, 'WebAPI must be available');
      return window.textsecure.server.putStickers(manifest, stickers, () =>
        ipcRenderer.send('art-creator:onUploadProgress')
      );
    },

    ...overrideEvents,
  };
}

function showUnknownSgnlLinkModal(): void {
  window.reduxActions.globalModals.showErrorModal({
    description: window.i18n('icu:unknown-sgnl-link'),
  });
}

function getEphemeralSetting<Name extends keyof EphemeralSettings>(
  name: Name
): Promise<EphemeralSettings[Name]> {
  return ipcRenderer.invoke(`settings:get:${name}`);
}

function setEphemeralSetting<Name extends keyof EphemeralSettings>(
  name: Name,
  value: EphemeralSettings[Name]
): Promise<void> {
  return ipcRenderer.invoke(`settings:set:${name}`, value);
}
