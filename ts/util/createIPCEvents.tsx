// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { webFrame } from 'electron';
import type { AudioDevice } from 'ringrtc';
import * as React from 'react';
import * as RemoteConfig from '../RemoteConfig';

import type { ZoomFactorType } from '../types/Storage.d';
import type {
  ConversationColorType,
  CustomColorType,
  DefaultConversationColorType,
} from '../types/Colors';
import { DEFAULT_CONVERSATION_COLOR } from '../types/Colors';
import * as Stickers from '../types/Stickers';
import type { SystemTraySetting } from '../types/SystemTraySetting';
import { parseSystemTraySetting } from '../types/SystemTraySetting';

import { ReactWrapperView } from '../views/ReactWrapperView';
import { ErrorModal } from '../components/ErrorModal';

import type { ConversationType } from '../state/ducks/conversations';
import { calling } from '../services/calling';
import { getConversationsWithCustomColorSelector } from '../state/selectors/conversations';
import { getCustomColors } from '../state/selectors/items';
import { trigger } from '../shims/events';
import { themeChanged } from '../shims/themeChanged';
import { renderClearingDataView } from '../shims/renderClearingDataView';

import * as universalExpireTimer from './universalExpireTimer';
import { PhoneNumberDiscoverability } from './phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from './phoneNumberSharingMode';
import { assert } from './assert';
import * as durations from './durations';
import { isPhoneNumberSharingEnabled } from './isPhoneNumberSharingEnabled';
import { parseE164FromSignalDotMeHash } from './sgnlHref';
import * as log from '../logging/log';

type ThemeType = 'light' | 'dark' | 'system';
type NotificationSettingType = 'message' | 'name' | 'count' | 'off';

export type IPCEventsValuesType = {
  alwaysRelayCalls: boolean | undefined;
  audioNotification: boolean | undefined;
  autoDownloadUpdate: boolean;
  autoLaunch: boolean;
  callRingtoneNotification: boolean;
  callSystemNotification: boolean;
  countMutedConversations: boolean;
  hasStoriesEnabled: boolean;
  hideMenuBar: boolean | undefined;
  incomingCallNotification: boolean;
  lastSyncTime: number | undefined;
  notificationDrawAttention: boolean;
  notificationSetting: NotificationSettingType;
  preferredAudioInputDevice: AudioDevice | undefined;
  preferredAudioOutputDevice: AudioDevice | undefined;
  preferredVideoInputDevice: string | undefined;
  spellCheck: boolean;
  systemTraySetting: SystemTraySetting;
  themeSetting: ThemeType;
  universalExpireTimer: number;
  zoomFactor: ZoomFactorType;

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
  deleteAllData: () => Promise<void>;
  closeDB: () => Promise<void>;
  editCustomColor: (colorId: string, customColor: CustomColorType) => void;
  getConversationsWithCustomColor: (x: string) => Array<ConversationType>;
  installStickerPack: (packId: string, key: string) => Promise<void>;
  isPhoneNumberSharingEnabled: () => boolean;
  isPrimary: () => boolean;
  removeCustomColor: (x: string) => void;
  removeCustomColorOnConversations: (x: string) => void;
  removeDarkOverlay: () => void;
  resetAllChatColors: () => void;
  resetDefaultChatColor: () => void;
  showConversationViaSignalDotMe: (hash: string) => void;
  showKeyboardShortcuts: () => void;
  showGroupViaLink: (x: string) => Promise<void>;
  showReleaseNotes: () => void;
  showStickerPack: (packId: string, key: string) => void;
  shutdown: () => Promise<void>;
  unknownSignalLink: () => void;
  getCustomColors: () => Record<string, CustomColorType>;
  syncRequest: () => Promise<void>;
  setGlobalDefaultConversationColor: (
    color: ConversationColorType,
    customColor?: { id: string; value: CustomColorType }
  ) => void;
  shouldShowStoriesSettings: () => boolean;
  getDefaultConversationColor: () => DefaultConversationColorType;
  persistZoomFactor: (factor: number) => Promise<void>;
};

type ValuesWithGetters = Omit<
  IPCEventsValuesType,
  // Optional
  'mediaPermissions' | 'mediaCameraPermissions' | 'autoLaunch'
>;

type ValuesWithSetters = Omit<
  IPCEventsValuesType,
  | 'blockedCount'
  | 'defaultConversationColor'
  | 'linkPreviewSetting'
  | 'phoneNumberDiscoverabilitySetting'
  | 'phoneNumberSharingSetting'
  | 'readReceiptSetting'
  | 'typingIndicatorSetting'
  | 'deviceName'

  // Optional
  | 'mediaPermissions'
  | 'mediaCameraPermissions'
>;

export type IPCEventGetterType<Key extends keyof IPCEventsValuesType> =
  `get${Capitalize<Key>}`;

export type IPCEventSetterType<Key extends keyof IPCEventsValuesType> =
  `set${Capitalize<Key>}`;

export type IPCEventsGettersType = {
  [Key in keyof ValuesWithGetters as IPCEventGetterType<Key>]: () => ValuesWithGetters[Key];
} & {
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
  IPCEventsCallbacksType;

export function createIPCEvents(
  overrideEvents: Partial<IPCEventsType> = {}
): IPCEventsType {
  return {
    getDeviceName: () => window.textsecure.storage.user.getDeviceName(),

    getZoomFactor: () => window.storage.get('zoomFactor', 1),
    setZoomFactor: async (zoomFactor: ZoomFactorType) => {
      webFrame.setZoomFactor(zoomFactor);
    },

    getHasStoriesEnabled: () => window.storage.get('hasStoriesEnabled', true),
    setHasStoriesEnabled: (value: boolean) =>
      window.storage.put('hasStoriesEnabled', value),

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
      window.storage.blocked.getBlockedUuids().length +
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
    getThemeSetting: () => window.storage.get('theme-setting', 'system'),
    setThemeSetting: value => {
      const promise = window.storage.put('theme-setting', value);
      themeChanged();
      return promise;
    },
    getHideMenuBar: () => window.storage.get('hide-menu-bar'),
    setHideMenuBar: value => {
      const promise = window.storage.put('hide-menu-bar', value);
      window.setAutoHideMenuBar(value);
      window.setMenuBarVisibility(!value);
      return promise;
    },
    getSystemTraySetting: () =>
      parseSystemTraySetting(window.storage.get('system-tray-setting')),
    setSystemTraySetting: value => {
      const promise = window.storage.put('system-tray-setting', value);
      window.updateSystemTraySetting(value);
      return promise;
    },

    getNotificationSetting: () =>
      window.storage.get('notification-setting', 'message'),
    setNotificationSetting: (value: 'message' | 'name' | 'count' | 'off') =>
      window.storage.put('notification-setting', value),
    getNotificationDrawAttention: () =>
      window.storage.get('notification-draw-attention', true),
    setNotificationDrawAttention: value =>
      window.storage.put('notification-draw-attention', value),
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

    getSpellCheck: () => window.storage.get('spell-check', true),
    setSpellCheck: value => window.storage.put('spell-check', value),

    getAlwaysRelayCalls: () => window.storage.get('always-relay-calls'),
    setAlwaysRelayCalls: value =>
      window.storage.put('always-relay-calls', value),

    getAutoLaunch: () => window.getAutoLaunch(),
    setAutoLaunch: async (value: boolean) => {
      return window.setAutoLaunch(value);
    },

    isPhoneNumberSharingEnabled: () => isPhoneNumberSharingEnabled(),
    isPrimary: () => window.textsecure.storage.user.getDeviceId() === 1,
    shouldShowStoriesSettings: () =>
      RemoteConfig.isEnabled('desktop.internalUser') ||
      RemoteConfig.isEnabled('desktop.stories'),
    syncRequest: () =>
      new Promise<void>((resolve, reject) => {
        const FIVE_MINUTES = 5 * durations.MINUTE;
        const syncRequest = window.getSyncRequest(FIVE_MINUTES);
        syncRequest.addEventListener('success', () => resolve());
        syncRequest.addEventListener('timeout', () =>
          reject(new Error('timeout'))
        );
      }),
    getLastSyncTime: () => window.storage.get('synced_at'),
    setLastSyncTime: value => window.storage.put('synced_at', value),
    getUniversalExpireTimer: () => universalExpireTimer.get(),
    setUniversalExpireTimer: async newValue => {
      await universalExpireTimer.set(newValue);

      // Update account in Storage Service
      const conversationId =
        window.ConversationController.getOurConversationIdOrThrow();
      const account = window.ConversationController.get(conversationId);
      assert(account, "Account wasn't found");

      account.captureChange('universalExpireTimer');

      // Add a notification to the currently open conversation
      const state = window.reduxStore.getState();
      const selectedId = state.conversations.selectedConversationId;
      if (selectedId) {
        const conversation = window.ConversationController.get(selectedId);
        assert(conversation, "Conversation wasn't found");

        await conversation.updateLastMessage();
      }
    },

    addDarkOverlay: () => {
      if ($('.dark-overlay').length) {
        return;
      }
      $(document.body).prepend('<div class="dark-overlay"></div>');
      $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
    },
    removeDarkOverlay: () => $('.dark-overlay').remove(),
    showKeyboardShortcuts: () => window.showKeyboardShortcuts(),

    deleteAllData: async () => {
      await window.Signal.Data.goBackToMainProcess();

      renderClearingDataView();
    },

    closeDB: async () => {
      await window.Signal.Data.goBackToMainProcess();
    },

    showStickerPack: (packId, key) => {
      // We can get these events even if the user has never linked this instance.
      if (!window.Signal.Util.Registration.everDone()) {
        log.warn('showStickerPack: Not registered, returning early');
        return;
      }
      if (window.isShowingModal) {
        log.warn('showStickerPack: Already showing modal, returning early');
        return;
      }
      try {
        window.isShowingModal = true;

        // Kick off the download
        Stickers.downloadEphemeralPack(packId, key);

        const props = {
          packId,
          onClose: async () => {
            window.isShowingModal = false;
            stickerPreviewModalView.remove();
            await Stickers.removeEphemeralPack(packId);
          },
        };

        const stickerPreviewModalView = new ReactWrapperView({
          className: 'sticker-preview-modal-wrapper',
          JSX: window.Signal.State.Roots.createStickerPreviewModal(
            window.reduxStore,
            props
          ),
        });
      } catch (error) {
        window.isShowingModal = false;
        log.error(
          'showStickerPack: Ran into an error!',
          error && error.stack ? error.stack : error
        );
        const errorView = new ReactWrapperView({
          className: 'error-modal-wrapper',
          JSX: (
            <ErrorModal
              i18n={window.i18n}
              onClose={() => {
                errorView.remove();
              }}
            />
          ),
        });
      }
    },
    showGroupViaLink: async hash => {
      // We can get these events even if the user has never linked this instance.
      if (!window.Signal.Util.Registration.everDone()) {
        log.warn('showGroupViaLink: Not registered, returning early');
        return;
      }
      if (window.isShowingModal) {
        log.warn('showGroupViaLink: Already showing modal, returning early');
        return;
      }
      try {
        await window.Signal.Groups.joinViaLink(hash);
      } catch (error) {
        log.error(
          'showGroupViaLink: Ran into an error!',
          error && error.stack ? error.stack : error
        );
        const errorView = new ReactWrapperView({
          className: 'error-modal-wrapper',
          JSX: (
            <ErrorModal
              i18n={window.i18n}
              title={window.i18n('GroupV2--join--general-join-failure--title')}
              description={window.i18n('GroupV2--join--general-join-failure')}
              onClose={() => {
                errorView.remove();
              }}
            />
          ),
        });
      }
      window.isShowingModal = false;
    },
    showConversationViaSignalDotMe(hash: string) {
      if (!window.Signal.Util.Registration.everDone()) {
        log.info(
          'showConversationViaSignalDotMe: Not registered, returning early'
        );
        return;
      }

      const maybeE164 = parseE164FromSignalDotMeHash(hash);
      if (maybeE164) {
        trigger('showConversation', maybeE164);
        return;
      }

      log.info('showConversationViaSignalDotMe: invalid E164');
      if (window.isShowingModal) {
        log.info(
          'showConversationViaSignalDotMe: a modal is already showing. Doing nothing'
        );
      } else {
        showUnknownSgnlLinkModal();
      }
    },

    unknownSignalLink: () => {
      log.warn('unknownSignalLink: Showing error dialog');
      showUnknownSgnlLinkModal();
    },

    installStickerPack: async (packId, key) => {
      Stickers.downloadStickerPack(packId, key, {
        finalStatus: 'installed',
      });
    },

    shutdown: () => Promise.resolve(),
    showReleaseNotes: () => {
      const { showWhatsNewModal } = window.reduxActions.globalModals;
      showWhatsNewModal();
    },

    getMediaPermissions: window.getMediaPermissions,
    getMediaCameraPermissions: window.getMediaCameraPermissions,

    persistZoomFactor: zoomFactor =>
      window.storage.put('zoomFactor', zoomFactor),

    ...overrideEvents,
  };
}

function showUnknownSgnlLinkModal(): void {
  const errorView = new ReactWrapperView({
    className: 'error-modal-wrapper',
    JSX: (
      <ErrorModal
        i18n={window.i18n}
        description={window.i18n('unknown-sgnl-link')}
        onClose={() => {
          errorView.remove();
        }}
      />
    ),
  });
}
