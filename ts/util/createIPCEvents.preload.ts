// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type { SystemPreferences } from 'electron';
import lodash from 'lodash';

import type { ZoomFactorType } from '../types/Storage.d.ts';
import * as Errors from '../types/errors.std.js';
import * as Stickers from '../types/Stickers.preload.js';
import * as Settings from '../types/Settings.std.js';

import { resolveUsernameByLinkBase64 } from '../services/username.preload.js';
import { isInCall } from '../state/selectors/calling.std.js';

import * as Registration from './registration.preload.js';
import { lookupConversationWithoutServiceId } from './lookupConversationWithoutServiceId.preload.js';
import { createLogger } from '../logging/log.std.js';
import {
  type NotificationClickData,
  notificationService,
} from '../services/notifications.preload.js';
import { joinViaLink } from '../groups.preload.js';
import {
  StoryViewModeType,
  StoryViewTargetType,
} from '../types/Stories.std.js';
import { isValidE164 } from './isValidE164.std.js';
import { fromWebSafeBase64 } from './webSafeBase64.std.js';
import { showConfirmationDialog } from './showConfirmationDialog.dom.js';
import type {
  EphemeralSettings,
  SettingsValuesType,
  ThemeType,
} from './preload.preload.js';
import { SystemTraySetting } from '../types/SystemTraySetting.std.js';
import { putStickers } from '../textsecure/WebAPI.preload.js';
import OS from './os/osPreload.preload.js';

const { noop } = lodash;

const log = createLogger('createIPCEvents');
const { i18n } = window.SignalContext;

export type IPCEventsValuesType = {
  // IPC-mediated
  autoLaunch: boolean;
  mediaPermissions: boolean;
  mediaCameraPermissions: boolean | undefined;
  zoomFactor: ZoomFactorType;
};

export type IPCEventsCallbacksType = {
  addDarkOverlay: () => void;
  removeDarkOverlay: () => void;

  cleanupDownloads: () => Promise<void>;
  getIsInCall: () => boolean;
  getMediaAccessStatus: (
    mediaType: 'screen' | 'microphone' | 'camera'
  ) => Promise<ReturnType<SystemPreferences['getMediaAccessStatus']>>;
  installStickerPack: (packId: string, key: string) => Promise<void>;
  requestCloseConfirmation: () => Promise<boolean>;
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
  shutdown: () => Promise<void>;
  startCallingLobbyViaToken: (token: string) => void;
  unknownSignalLink: () => void;
  uploadStickerPack: (
    manifest: Uint8Array,
    stickers: ReadonlyArray<Uint8Array>
  ) => Promise<string>;
};

type ValuesWithGetters = Omit<
  SettingsValuesType,
  // Async - we'll redefine these in IPCEventsGettersType
  | 'autoLaunch'
  | 'localeOverride'
  | 'mediaPermissions'
  | 'mediaCameraPermissions'
  | 'spellCheck'
  | 'contentProtection'
  | 'systemTraySetting'
  | 'themeSetting'
  | 'zoomFactor'
>;

// Right now everything is symmetrical
type ValuesWithSetters = SettingsValuesType;

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

export type ZoomFactorChangeCallback = (zoomFactor: ZoomFactorType) => void;
export type IPCEventsGettersType = {
  [Key in keyof ValuesWithGetters as IPCEventGetterType<Key>]: () => ValuesWithGetters[Key];
} & {
  // Async
  getAutoLaunch: () => Promise<boolean>;
  getLocaleOverride: () => Promise<string | null>;
  getMediaPermissions: () => Promise<boolean>;
  getMediaCameraPermissions: () => Promise<boolean>;
  getSpellCheck: () => Promise<boolean>;
  getContentProtection: () => Promise<boolean>;
  getSystemTraySetting: () => Promise<SystemTraySetting>;
  getThemeSetting: () => Promise<ThemeType>;
  getZoomFactor: () => Promise<ZoomFactorType>;
  // Events
  onZoomFactorChange: (callback: ZoomFactorChangeCallback) => void;
  offZoomFactorChange: (callback: ZoomFactorChangeCallback) => void;
};

export type IPCEventsSettersType = {
  [Key in keyof ValuesWithSetters as IPCEventSetterType<Key>]: (
    value: NonNullable<ValuesWithSetters[Key]>
  ) => Promise<void>;
} & {
  setLocaleOverride: (value: string | null) => Promise<void>;
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
  let zoomFactorChangeCallbacks: Array<ZoomFactorChangeCallback> = [];
  ipcRenderer.on('zoomFactorChanged', (_event, zoomFactor) => {
    zoomFactorChangeCallbacks.forEach(callback => callback(zoomFactor));
  });

  return {
    // From IPCEventsValuesType
    getAutoLaunch: async () => {
      return (await window.IPC.getAutoLaunch()) ?? false;
    },
    setAutoLaunch: async (value: boolean) => {
      await window.IPC.setAutoLaunch(value);
    },
    getMediaCameraPermissions: async () => {
      return (await window.IPC.getMediaCameraPermissions()) ?? false;
    },
    setMediaCameraPermissions: async () => {
      const forCamera = true;
      await window.IPC.showPermissionsPopup(false, forCamera);
    },
    getMediaPermissions: async () => {
      return (await window.IPC.getMediaPermissions()) ?? false;
    },
    setMediaPermissions: async () => {
      const forCalling = true;
      await window.IPC.showPermissionsPopup(forCalling, false);
    },
    getZoomFactor: () => {
      return ipcRenderer.invoke('getZoomFactor');
    },
    setZoomFactor: async zoomFactor => {
      ipcRenderer.send('setZoomFactor', zoomFactor);
    },

    // From IPCEventsGettersType
    onZoomFactorChange: callback => {
      zoomFactorChangeCallbacks.push(callback);
    },
    offZoomFactorChange: toRemove => {
      zoomFactorChangeCallbacks = zoomFactorChangeCallbacks.filter(
        callback => toRemove !== callback
      );
    },

    // From EphemeralSettings
    getLocaleOverride: async () => {
      return (await getEphemeralSetting('localeOverride')) ?? null;
    },
    setLocaleOverride: async (value: string | null) => {
      await setEphemeralSetting('localeOverride', value);
      window.SignalContext.restartApp();
    },
    getContentProtection: async () => {
      return (
        !window.SignalContext.config.disableScreenSecurity &&
        ((await getEphemeralSetting('contentProtection')) ??
          Settings.isContentProtectionEnabledByDefault(
            OS,
            window.SignalContext.config.osRelease
          ))
      );
    },
    setContentProtection: async (value: boolean) => {
      await setEphemeralSetting('contentProtection', value);
    },
    getSpellCheck: async () => {
      return (await getEphemeralSetting('spellCheck')) ?? false;
    },
    setSpellCheck: async (value: boolean) => {
      await setEphemeralSetting('spellCheck', value);
    },
    getSystemTraySetting: async () => {
      return (
        (await getEphemeralSetting('systemTraySetting')) ??
        SystemTraySetting.Uninitialized
      );
    },
    setSystemTraySetting: async (value: SystemTraySetting) => {
      await setEphemeralSetting('systemTraySetting', value);
    },
    getThemeSetting: async () => {
      return (await getEphemeralSetting('themeSetting')) ?? 'system';
    },
    setThemeSetting: async (value: ThemeType) => {
      await setEphemeralSetting('themeSetting', value);
    },

    // From IPCEventsCallbacksType
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
    cleanupDownloads: async () => {
      await ipcRenderer.invoke('cleanup-downloads');
    },
    getIsInCall: (): boolean => {
      return isInCall(window.reduxStore.getState());
    },
    getMediaAccessStatus: async (
      mediaType: 'screen' | 'microphone' | 'camera'
    ) => {
      return window.IPC.getMediaAccessStatus(mediaType);
    },
    installStickerPack: async (packId, key) => {
      void Stickers.downloadStickerPack(packId, key, {
        finalStatus: 'installed',
        actionSource: 'ui',
      });
    },
    requestCloseConfirmation: async (): Promise<boolean> => {
      try {
        await new Promise<void>((resolve, reject) => {
          showConfirmationDialog({
            dialogName: 'closeConfirmation',
            onTopOfEverything: true,
            cancelText: i18n(
              'icu:ConfirmationDialog__Title--close-requested-not-now'
            ),
            confirmStyle: 'negative',
            title: i18n(
              'icu:ConfirmationDialog__Title--in-call-close-requested'
            ),
            okText: i18n('icu:close'),
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
        log.info('requestCloseConfirmation: Close canceled by user.');
        return false;
      }
    },
    setMediaPlaybackDisabled: (playbackDisabled: boolean) => {
      window.reduxActions?.lightbox.setPlaybackDisabled(playbackDisabled);
      if (playbackDisabled) {
        window.reduxActions?.audioPlayer.pauseVoiceNotePlayer();
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

      try {
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
      } catch (error) {
        log.warn(
          'showConversationViaSignalDotMe: got error',
          Errors.toLogFormat(error)
        );
        showUnknownSgnlLinkModal();
        return;
      }

      log.info('showConversationViaSignalDotMe: invalid E164');
      showUnknownSgnlLinkModal();
    },
    showKeyboardShortcuts: () =>
      window.reduxActions.globalModals.showShortcutGuideModal(),
    showGroupViaLink: async value => {
      // We can get these events even if the user has never linked this instance.
      if (!Registration.everDone()) {
        log.warn('showGroupViaLink: Not registered, returning early');
        return;
      }
      try {
        await joinViaLink(value);
      } catch (error) {
        log.error(
          'showGroupViaLink: Ran into an error!',
          Errors.toLogFormat(error)
        );
        window.reduxActions.globalModals.showErrorModal({
          title: i18n('icu:GroupV2--join--general-join-failure--title'),
          description: i18n('icu:GroupV2--join--general-join-failure'),
        });
      }
    },
    showReleaseNotes: () => {
      const { showWhatsNewModal } = window.reduxActions.globalModals;
      showWhatsNewModal();
    },
    showStickerPack: (packId, key) => {
      // We can get these events even if the user has never linked this instance.
      if (!Registration.everDone()) {
        log.warn('showStickerPack: Not registered, returning early');
        return;
      }
      window.reduxActions.globalModals.showStickerPackPreview(packId, key);
    },
    shutdown: () => Promise.resolve(),
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
    unknownSignalLink: () => {
      log.warn('unknownSignalLink: Showing error dialog');
      showUnknownSgnlLinkModal();
    },
    uploadStickerPack: (
      manifest: Uint8Array,
      stickers: ReadonlyArray<Uint8Array>
    ): Promise<string> => {
      return putStickers(manifest, stickers, () =>
        ipcRenderer.send('art-creator:onUploadProgress')
      );
    },
    ...overrideEvents,
  };
}

function showUnknownSgnlLinkModal(): void {
  window.reduxActions.globalModals.showErrorModal({
    description: i18n('icu:unknown-sgnl-link'),
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
