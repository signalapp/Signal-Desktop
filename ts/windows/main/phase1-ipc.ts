// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';
import * as semver from 'semver';
import { mapValues } from 'lodash';

import type { IPCType } from '../../window.d';
import { parseIntWithFallback } from '../../util/parseIntWithFallback';
import { UUIDKind } from '../../types/UUID';
import { ThemeType } from '../../types/Util';
import { getEnvironment, Environment } from '../../environment';
import { SignalContext } from '../context';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';

import { strictAssert } from '../../util/assert';

// It is important to call this as early as possible
window.i18n = SignalContext.i18n;

// We are comfortable doing this because we verified the type on the other side!
const { config } = window.SignalContext;

// Flags for testing
const Flags = {
  GV2_ENABLE_CHANGE_PROCESSING: true,
  GV2_ENABLE_PRE_JOIN_FETCH: true,
  GV2_ENABLE_SINGLE_CHANGE_PROCESSING: true,
  GV2_ENABLE_STATE_PROCESSING: true,
  GV2_MIGRATION_DISABLE_ADD: false,
  GV2_MIGRATION_DISABLE_INVITE: false,
};

window.Flags = Flags;

window.RETRY_DELAY = false;

window.platform = process.platform;
window.getTitle = () => title;
window.getResolvedMessagesLocale = () => config.resolvedTranslationsLocale;
window.getPreferredSystemLocales = () => config.preferredSystemLocales;
window.getEnvironment = getEnvironment;
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.getBuildCreation = () => parseIntWithFallback(config.buildCreation, 0);
window.getBuildExpiration = () => config.buildExpiration;
window.getHostName = () => config.hostname;
window.getServerTrustRoot = () => config.serverTrustRoot;
window.getServerPublicParams = () => config.serverPublicParams;
window.getSfuUrl = () => config.sfuUrl;
window.isBehindProxy = () => Boolean(config.proxyUrl);

let title = config.name;
if (getEnvironment() !== Environment.Production) {
  title += ` - ${getEnvironment()}`;
}
if (config.appInstance) {
  title += ` - ${config.appInstance}`;
}

if (config.theme === 'light') {
  window.initialTheme = ThemeType.light;
} else if (config.theme === 'dark') {
  window.initialTheme = ThemeType.dark;
}

const IPC: IPCType = {
  addSetupMenuItems: () => ipc.send('add-setup-menu-items'),
  closeAbout: () => ipc.send('close-about'),
  crashReports: {
    getCount: () => ipc.invoke('crash-reports:get-count'),
    upload: () => ipc.invoke('crash-reports:upload'),
    erase: () => ipc.invoke('crash-reports:erase'),
  },
  drawAttention: () => {
    log.info('draw attention');
    ipc.send('draw-attention');
  },
  getAutoLaunch: () => ipc.invoke('get-auto-launch'),
  getBuiltInImages: () =>
    new Promise((resolve, reject) => {
      ipc.once('get-success-built-in-images', (_event, error, value) => {
        if (error) {
          return reject(new Error(error));
        }

        return resolve(value);
      });
      ipc.send('get-built-in-images');
    }),
  getMediaPermissions: () => ipc.invoke('settings:get:mediaPermissions'),
  getMediaCameraPermissions: () =>
    ipc.invoke('settings:get:mediaCameraPermissions'),
  logAppLoadedEvent: ({ processedCount }) =>
    ipc.send('signal-app-loaded', {
      preloadTime: window.preloadEndTime - window.preloadStartTime,
      connectTime: preloadConnectTime - window.preloadEndTime,
      processedCount,
    }),
  readyForUpdates: () => ipc.send('ready-for-updates'),
  removeSetupMenuItems: () => ipc.send('remove-setup-menu-items'),
  restart: () => {
    log.info('restart');
    ipc.send('restart');
  },
  setAutoHideMenuBar: autoHide => ipc.send('set-auto-hide-menu-bar', autoHide),
  setAutoLaunch: value => ipc.invoke('set-auto-launch', value),
  setBadgeCount: count => ipc.send('set-badge-count', count),
  setMenuBarVisibility: visibility =>
    ipc.send('set-menu-bar-visibility', visibility),
  showDebugLog: () => {
    log.info('showDebugLog');
    ipc.send('show-debug-log');
  },
  showPermissionsPopup: (forCalling, forCamera) =>
    ipc.invoke('show-permissions-popup', forCalling, forCamera),
  showSettings: () => ipc.send('show-settings'),
  showWindow: () => {
    log.info('show window');
    ipc.send('show-window');
  },
  shutdown: () => {
    log.info('shutdown');
    ipc.send('shutdown');
  },
  titleBarDoubleClick: () => {
    ipc.send('title-bar-double-click');
  },
  updateSystemTraySetting: (
    systemTraySetting /* : Readonly<SystemTraySetting> */
  ) => {
    void ipc.invoke('update-system-tray-setting', systemTraySetting);
  },
  updateTrayIcon: unreadCount => ipc.send('update-tray-icon', unreadCount),
};

window.IPC = IPC;

window.isBeforeVersion = (toCheck, baseVersion) => {
  try {
    return semver.lt(toCheck, baseVersion);
  } catch (error) {
    log.error(
      `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
      Errors.toLogFormat(error)
    );
    return true;
  }
};
window.isAfterVersion = (toCheck, baseVersion) => {
  try {
    return semver.gt(toCheck, baseVersion);
  } catch (error) {
    log.error(
      `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
      Errors.toLogFormat(error)
    );
    return true;
  }
};

let preloadConnectTime = 0;
window.logAuthenticatedConnect = () => {
  if (preloadConnectTime === 0) {
    preloadConnectTime = Date.now();
  }
};

// We never do these in our code, so we'll prevent it everywhere
window.open = () => null;

// Playwright uses `eval` for `.evaluate()` API
if (!config.enableCI && config.environment !== 'test') {
  // eslint-disable-next-line no-eval, no-multi-assign
  window.eval = global.eval = () => null;
}

ipc.on('additional-log-data-request', async event => {
  const ourConversation = window.ConversationController.getOurConversation();
  const ourCapabilities = ourConversation
    ? ourConversation.get('capabilities')
    : undefined;

  const remoteConfig = window.storage.get('remoteConfig') || {};

  let statistics;
  try {
    statistics = await window.Signal.Data.getStatisticsForLogging();
  } catch (error) {
    statistics = {};
  }

  const ourUuid = window.textsecure.storage.user.getUuid();
  const ourPni = window.textsecure.storage.user.getUuid(UUIDKind.PNI);

  event.sender.send('additional-log-data-response', {
    capabilities: ourCapabilities || {},
    remoteConfig: mapValues(remoteConfig, ({ value, enabled }) => {
      const enableString = enabled ? 'enabled' : 'disabled';
      const valueString = value && value !== 'TRUE' ? ` ${value}` : '';
      return `${enableString}${valueString}`;
    }),
    statistics,
    user: {
      deviceId: window.textsecure.storage.user.getDeviceId(),
      e164: window.textsecure.storage.user.getNumber(),
      uuid: ourUuid && ourUuid.toString(),
      pni: ourPni && ourPni.toString(),
      conversationId: ourConversation && ourConversation.id,
    },
  });
});

ipc.on('set-up-as-new-device', () => {
  window.Whisper.events.trigger('setupAsNewDevice');
});

ipc.on('set-up-as-standalone', () => {
  window.Whisper.events.trigger('setupAsStandalone');
});

ipc.on('challenge:response', (_event, response) => {
  window.Whisper.events.trigger('challengeResponse', response);
});

ipc.on('power-channel:suspend', () => {
  window.Whisper.events.trigger('powerMonitorSuspend');
});

ipc.on('power-channel:resume', () => {
  window.Whisper.events.trigger('powerMonitorResume');
});

ipc.on('power-channel:lock-screen', () => {
  window.Whisper.events.trigger('powerMonitorLockScreen');
});

ipc.on('window:set-window-stats', (_event, stats) => {
  if (!window.reduxActions) {
    return;
  }

  window.reduxActions.user.userChanged({
    isMainWindowMaximized: stats.isMaximized,
    isMainWindowFullScreen: stats.isFullScreen,
  });
});

ipc.on('window:set-menu-options', (_event, options) => {
  if (!window.Whisper.events) {
    return;
  }
  window.Whisper.events.trigger('setMenuOptions', options);
});

window.sendChallengeRequest = request => ipc.send('challenge:request', request);

// Settings-related events

ipc.on('show-keyboard-shortcuts', () => {
  window.Events.showKeyboardShortcuts();
});
ipc.on('add-dark-overlay', () => {
  window.Events.addDarkOverlay();
});
ipc.on('remove-dark-overlay', () => {
  window.Events.removeDarkOverlay();
});

ipc.on('delete-all-data', async () => {
  const { deleteAllData } = window.Events;
  if (!deleteAllData) {
    return;
  }

  try {
    await deleteAllData();
  } catch (error) {
    log.error('delete-all-data: error', Errors.toLogFormat(error));
  }
});

ipc.on('show-sticker-pack', (_event, info) => {
  const { packId, packKey } = info;
  const { showStickerPack } = window.Events;
  if (showStickerPack) {
    showStickerPack(packId, packKey);
  }
});

ipc.on('show-group-via-link', (_event, info) => {
  const { hash } = info;
  const { showGroupViaLink } = window.Events;
  if (showGroupViaLink) {
    void showGroupViaLink(hash);
  }
});

ipc.on('show-conversation-via-signal.me', (_event, info) => {
  const { hash } = info;
  strictAssert(typeof hash === 'string', 'Got an invalid hash over IPC');

  const { showConversationViaSignalDotMe } = window.Events;
  if (showConversationViaSignalDotMe) {
    void showConversationViaSignalDotMe(hash);
  }
});

ipc.on('unknown-sgnl-link', () => {
  const { unknownSignalLink } = window.Events;
  if (unknownSignalLink) {
    unknownSignalLink();
  }
});

ipc.on('install-sticker-pack', (_event, info) => {
  const { packId, packKey } = info;
  const { installStickerPack } = window.Events;
  if (installStickerPack) {
    void installStickerPack(packId, packKey);
  }
});

ipc.on('get-ready-for-shutdown', async () => {
  const { shutdown } = window.Events || {};
  if (!shutdown) {
    log.error('preload shutdown handler: shutdown method not found');
    ipc.send('now-ready-for-shutdown');
    return;
  }

  try {
    await shutdown();
    ipc.send('now-ready-for-shutdown');
  } catch (error) {
    ipc.send('now-ready-for-shutdown', Errors.toLogFormat(error));
  }
});

ipc.on('show-release-notes', () => {
  const { showReleaseNotes } = window.Events;
  if (showReleaseNotes) {
    showReleaseNotes();
  }
});
