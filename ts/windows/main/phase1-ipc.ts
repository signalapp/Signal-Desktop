// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';
import * as semver from 'semver';
import { mapValues, noop } from 'lodash';

import { parseIntWithFallback } from '../../util/parseIntWithFallback';
import { UUIDKind } from '../../types/UUID';
import { ThemeType } from '../../types/Util';
import { getEnvironment, Environment } from '../../environment';
import { SignalContext } from '../context';
import * as log from '../../logging/log';

import { strictAssert } from '../../util/assert';

// It is important to call this as early as possible
window.i18n = SignalContext.i18n;

// We are comfortable doing this because we verified the type on the other side!
const { config } = window.SignalContext;

// Flags for testing
window.GV2_ENABLE_SINGLE_CHANGE_PROCESSING = true;
window.GV2_ENABLE_CHANGE_PROCESSING = true;
window.GV2_ENABLE_STATE_PROCESSING = true;
window.GV2_ENABLE_PRE_JOIN_FETCH = true;

window.GV2_MIGRATION_DISABLE_ADD = false;
window.GV2_MIGRATION_DISABLE_INVITE = false;

window.RETRY_DELAY = false;

window.platform = process.platform;
window.getTitle = () => title;
window.getLocale = () => config.locale;
window.getEnvironment = getEnvironment;
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.getBuildCreation = () => parseIntWithFallback(config.buildCreation, 0);
window.getExpiration = () => {
  const sixtyDays = 60 * 86400 * 1000;
  const remoteBuildExpiration = window.storage.get('remoteBuildExpiration');
  const { buildExpiration } = config;

  const localBuildExpiration = window.Events.getAutoDownloadUpdate()
    ? buildExpiration
    : buildExpiration - sixtyDays;

  if (remoteBuildExpiration) {
    return remoteBuildExpiration < localBuildExpiration
      ? remoteBuildExpiration
      : localBuildExpiration;
  }
  return localBuildExpiration;
};
window.Accessibility = {
  reducedMotionSetting: Boolean(config.reducedMotionSetting),
};
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

window.getAutoLaunch = () => {
  return ipc.invoke('get-auto-launch');
};
window.setAutoLaunch = value => {
  return ipc.invoke('set-auto-launch', value);
};

window.isBeforeVersion = (toCheck, baseVersion) => {
  try {
    return semver.lt(toCheck, baseVersion);
  } catch (error) {
    log.error(
      `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
      error && error.stack ? error.stack : error
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
      error && error.stack ? error.stack : error
    );
    return true;
  }
};

window.setBadgeCount = count => ipc.send('set-badge-count', count);

let preloadConnectTime = 0;
window.logAuthenticatedConnect = () => {
  if (preloadConnectTime === 0) {
    preloadConnectTime = Date.now();
  }
};

window.logAppLoadedEvent = ({ processedCount }) =>
  ipc.send('signal-app-loaded', {
    preloadTime: window.preloadEndTime - window.preloadStartTime,
    connectTime: preloadConnectTime - window.preloadEndTime,
    processedCount,
  });

// We never do these in our code, so we'll prevent it everywhere
window.open = () => null;

// Playwright uses `eval` for `.evaluate()` API
if (!config.enableCI && config.environment !== 'test') {
  // eslint-disable-next-line no-eval, no-multi-assign
  window.eval = global.eval = () => null;
}

window.drawAttention = () => {
  log.info('draw attention');
  ipc.send('draw-attention');
};
window.showWindow = () => {
  log.info('show window');
  ipc.send('show-window');
};

window.titleBarDoubleClick = () => {
  ipc.send('title-bar-double-click');
};

window.setAutoHideMenuBar = autoHide =>
  ipc.send('set-auto-hide-menu-bar', autoHide);

window.setMenuBarVisibility = visibility =>
  ipc.send('set-menu-bar-visibility', visibility);

window.updateSystemTraySetting = (
  systemTraySetting /* : Readonly<SystemTraySetting> */
) => {
  ipc.send('update-system-tray-setting', systemTraySetting);
};

window.restart = () => {
  log.info('restart');
  ipc.send('restart');
};
window.shutdown = () => {
  log.info('shutdown');
  ipc.send('shutdown');
};
window.showDebugLog = () => {
  log.info('showDebugLog');
  ipc.send('show-debug-log');
};

window.closeAbout = () => ipc.send('close-about');
window.readyForUpdates = () => ipc.send('ready-for-updates');

window.updateTrayIcon = unreadCount =>
  ipc.send('update-tray-icon', unreadCount);

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
  if (!window.Whisper.events) {
    return;
  }
  window.Whisper.events.trigger('setWindowStats', stats);
});

ipc.on('window:set-menu-options', (_event, options) => {
  if (!window.Whisper.events) {
    return;
  }
  window.Whisper.events.trigger('setMenuOptions', options);
});

window.sendChallengeRequest = request => ipc.send('challenge:request', request);

{
  let isFullScreen = Boolean(config.isMainWindowFullScreen);
  let isMaximized = Boolean(config.isMainWindowMaximized);

  window.isFullScreen = () => isFullScreen;
  window.isMaximized = () => isMaximized;
  // This is later overwritten.
  window.onFullScreenChange = noop;

  ipc.on('window:set-window-stats', (_event, stats) => {
    isFullScreen = Boolean(stats.isFullScreen);
    isMaximized = Boolean(stats.isMaximized);
    window.onFullScreenChange(isFullScreen, isMaximized);
  });
}

// Settings-related events

window.showSettings = () => ipc.send('show-settings');
window.showPermissionsPopup = (forCalling, forCamera) =>
  ipc.invoke('show-permissions-popup', forCalling, forCamera);

ipc.on('show-keyboard-shortcuts', () => {
  window.Events.showKeyboardShortcuts();
});
ipc.on('add-dark-overlay', () => {
  window.Events.addDarkOverlay();
});
ipc.on('remove-dark-overlay', () => {
  window.Events.removeDarkOverlay();
});

window.getBuiltInImages = () =>
  new Promise((resolve, reject) => {
    ipc.once('get-success-built-in-images', (_event, error, value) => {
      if (error) {
        return reject(new Error(error));
      }

      return resolve(value);
    });
    ipc.send('get-built-in-images');
  });

ipc.on('delete-all-data', async () => {
  const { deleteAllData } = window.Events;
  if (!deleteAllData) {
    return;
  }

  try {
    await deleteAllData();
  } catch (error) {
    log.error('delete-all-data: error', error && error.stack);
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
    showGroupViaLink(hash);
  }
});

ipc.on('show-conversation-via-signal.me', (_event, info) => {
  const { hash } = info;
  strictAssert(typeof hash === 'string', 'Got an invalid hash over IPC');

  const { showConversationViaSignalDotMe } = window.Events;
  if (showConversationViaSignalDotMe) {
    showConversationViaSignalDotMe(hash);
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
    installStickerPack(packId, packKey);
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
    ipc.send(
      'now-ready-for-shutdown',
      error && error.stack ? error.stack : error
    );
  }
});

ipc.on('show-release-notes', () => {
  const { showReleaseNotes } = window.Events;
  if (showReleaseNotes) {
    showReleaseNotes();
  }
});

window.addSetupMenuItems = () => ipc.send('add-setup-menu-items');
window.removeSetupMenuItems = () => ipc.send('remove-setup-menu-items');
