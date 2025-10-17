// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EventEmitter from 'node:events';
import { ipcRenderer as ipc } from 'electron';
import * as semver from 'semver';
import lodash, { throttle } from 'lodash';

import type { IPCType } from '../../window.d.ts';
import { parseIntWithFallback } from '../../util/parseIntWithFallback.std.js';
import { getSignalConnections } from '../../util/getSignalConnections.preload.js';
import { ThemeType } from '../../types/Util.std.js';
import { Environment } from '../../environment.std.js';
import { SignalContext } from '../context.preload.js';
import { createLogger } from '../../logging/log.std.js';
import { formatCountForLogging } from '../../logging/formatCountForLogging.std.js';
import * as Errors from '../../types/errors.std.js';

import { strictAssert } from '../../util/assert.std.js';
import { drop } from '../../util/drop.std.js';
import { explodePromise } from '../../util/explodePromise.std.js';
import { DataReader } from '../../sql/Client.preload.js';
import type { WindowsNotificationData } from '../../services/notifications.preload.js';
import { finish3dsValidation } from '../../services/donations.preload.js';
import { AggregatedStats } from '../../textsecure/WebsocketResources.preload.js';
import { UNAUTHENTICATED_CHANNEL_NAME } from '../../textsecure/SocketManager.preload.js';
import { isProduction } from '../../util/version.std.js';
import { ToastType } from '../../types/Toast.dom.js';
import { ConversationController } from '../../ConversationController.preload.js';
import { isEnabled } from '../../RemoteConfig.dom.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { mapValues } = lodash;

const log = createLogger('phase1-ipc');

// We are comfortable doing this because we verified the type on the other side!
const { config } = SignalContext;

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

window.Whisper = {
  events: new EventEmitter(),
};
window.ConversationController = new ConversationController();
window.platform = process.platform;
window.getTitle = () => title;
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.getBuildCreation = () => parseIntWithFallback(config.buildCreation, 0);
window.getBuildExpiration = () => config.buildExpiration;
window.getHostName = () => config.hostname;
window.getServerTrustRoots = () => config.serverTrustRoots;
window.getServerPublicParams = () => config.serverPublicParams;
window.getGenericServerPublicParams = () => config.genericServerPublicParams;
window.getBackupServerPublicParams = () => config.backupServerPublicParams;
window.getSfuUrl = () => config.sfuUrl;

let title = config.name;
if (config.environment !== Environment.PackagedApp) {
  title += ` - ${config.environment}`;
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
  clearAllWindowsNotifications: async () => {
    log.info('show window');
    return ipc.invoke('windows-notifications:clear-all');
  },
  closeAbout: () => ipc.send('close-about'),
  crashReports: {
    getCount: () => ipc.invoke('crash-reports:get-count'),
    writeToLog: () => ipc.invoke('crash-reports:write-to-log'),
    erase: () => ipc.invoke('crash-reports:erase'),
  },
  drawAttention: () => {
    log.info('draw attention');
    ipc.send('draw-attention');
  },
  getAutoLaunch: () => ipc.invoke('get-auto-launch'),
  getMediaAccessStatus: mediaType =>
    ipc.invoke('get-media-access-status', mediaType),
  openSystemMediaPermissions: mediaType =>
    ipc.invoke('open-system-media-permissions', mediaType),
  getMediaPermissions: () => ipc.invoke('settings:get:mediaPermissions'),
  getMediaCameraPermissions: () =>
    ipc.invoke('settings:get:mediaCameraPermissions'),
  logAppLoadedEvent: ({ processedCount }) =>
    ipc.send('signal-app-loaded', {
      // Sequence of events:
      // 1. Preload compile start
      // 2. Preload start
      // 3. Preload end
      //
      // Compile time is thus: start - compileStart
      preloadCompileTime:
        window.preloadStartTime - window.preloadCompileStartTime,

      // Preload time is: end - start
      preloadTime: window.preloadEndTime - window.preloadStartTime,
      connectTime: preloadConnectTime - window.preloadEndTime,
      processedCount,
    }),
  readyForUpdates: () => ipc.send('ready-for-updates'),
  removeSetupMenuItems: () => ipc.send('remove-setup-menu-items'),
  setAutoHideMenuBar: autoHide => ipc.send('set-auto-hide-menu-bar', autoHide),
  setAutoLaunch: value => ipc.invoke('set-auto-launch', value),
  setBadge: badge => ipc.send('set-badge', badge),
  setMenuBarVisibility: visibility =>
    ipc.send('set-menu-bar-visibility', visibility),
  showDebugLog: () => {
    log.info('showDebugLog');
    ipc.send('show-debug-log');
  },
  showPermissionsPopup: (forCalling, forCamera) =>
    ipc.invoke('show-permissions-popup', forCalling, forCamera),
  setMediaPermissions: (value: boolean) =>
    ipc.invoke('settings:set:mediaPermissions', value),
  setMediaCameraPermissions: (value: boolean) =>
    ipc.invoke('settings:set:mediaCameraPermissions', value),
  showSettings: () => ipc.send('show-settings'),
  showWindow: () => {
    log.info('show window');
    ipc.send('show-window');
  },
  showWindowsNotification: async (data: WindowsNotificationData) => {
    return ipc.invoke('windows-notifications:show', data);
  },
  shutdown: () => {
    log.info('shutdown');
    ipc.send('shutdown');
  },
  startTrackingQueryStats: () => {
    ipc.send('start-tracking-query-stats');
  },
  stopTrackingQueryStats: options => {
    ipc.send('stop-tracking-query-stats', options);
  },
  titleBarDoubleClick: () => {
    ipc.send('title-bar-double-click');
  },
  updateTrayIcon: unreadCount => ipc.send('update-tray-icon', unreadCount),
  whenWindowVisible,
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
if (config.ciMode !== 'full' && config.environment !== Environment.Test) {
  // eslint-disable-next-line no-eval, no-multi-assign
  window.eval = global.eval = () => null;
}

type NetworkStatistics = {
  signalConnectionCount?: string;
  unauthorizedConnectionFailures?: string;
  unauthorizedRequestsCompared?: string;
  unauthorizedHealthcheckFailures?: string;
  unauthorizedHealthcheckBadStatus?: string;
  unauthorizedIpVersionMismatches?: string;
};

ipc.on('additional-log-data-request', async event => {
  const ourConversation = window.ConversationController.getOurConversation();
  const ourCapabilities = ourConversation
    ? ourConversation.get('capabilities')
    : undefined;

  const remoteConfig = itemStorage.get('remoteConfig') || {};

  let statistics;
  try {
    statistics = await DataReader.getStatisticsForLogging();
  } catch (error) {
    statistics = {};
  }

  let networkStatistics: NetworkStatistics = {
    signalConnectionCount: formatCountForLogging(getSignalConnections().length),
  };
  const unauthorizedStats = AggregatedStats.loadOrCreateEmpty(
    UNAUTHENTICATED_CHANNEL_NAME
  );
  if (unauthorizedStats.requestsCompared > 0) {
    networkStatistics = {
      ...networkStatistics,
      unauthorizedConnectionFailures: formatCountForLogging(
        unauthorizedStats.connectionFailures
      ),
      unauthorizedRequestsCompared: formatCountForLogging(
        unauthorizedStats.requestsCompared
      ),
      unauthorizedHealthcheckFailures: formatCountForLogging(
        unauthorizedStats.healthcheckFailures
      ),
      unauthorizedHealthcheckBadStatus: formatCountForLogging(
        unauthorizedStats.healthcheckBadStatus
      ),
      unauthorizedIpVersionMismatches: formatCountForLogging(
        unauthorizedStats.ipVersionMismatches
      ),
    };
  }

  const ourAci = itemStorage.user.getAci();
  const ourPni = itemStorage.user.getPni();

  event.sender.send('additional-log-data-response', {
    capabilities: ourCapabilities || {},
    remoteConfig: mapValues(remoteConfig, ({ value, enabled }) => {
      const enableString = enabled ? 'enabled' : 'disabled';
      const valueString = value && value !== 'TRUE' ? ` ${value}` : '';
      return `${enableString}${valueString}`;
    }),
    statistics: {
      ...statistics,
      ...networkStatistics,
    },
    user: {
      deviceId: itemStorage.user.getDeviceId(),
      uuid: ourAci,
      pni: ourPni,
      conversationId: ourConversation && ourConversation.id,
    },
  });
});

ipc.on('open-settings-tab', () => {
  window.Whisper.events.emit('openSettingsTab');
});

ipc.on('set-up-as-new-device', () => {
  window.Whisper.events.emit('setupAsNewDevice');
});

ipc.on('set-up-as-standalone', () => {
  window.Whisper.events.emit('setupAsStandalone');
});

ipc.on('stage-local-backup-for-import', () => {
  window.Whisper.events.emit('stageLocalBackupForImport');
});

ipc.on('challenge:response', (_event, response) => {
  window.Whisper.events.emit('challengeResponse', response);
});

ipc.on('power-channel:suspend', () => {
  window.Whisper.events.emit('powerMonitorSuspend');
});

ipc.on('power-channel:resume', () => {
  window.Whisper.events.emit('powerMonitorResume');
});

ipc.on('power-channel:lock-screen', () => {
  window.Whisper.events.emit('powerMonitorLockScreen');
});

ipc.on(
  'set-media-playback-disabled',
  (_event: unknown, playbackDisabled: unknown) => {
    const { setMediaPlaybackDisabled } = window.Events || {};
    if (setMediaPlaybackDisabled) {
      setMediaPlaybackDisabled(Boolean(playbackDisabled));
    }
  }
);

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
  window.Whisper.events.emit('setMenuOptions', options);
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

ipc.on('show-sticker-pack', (_event, info) => {
  window.Events.showStickerPack?.(info.packId, info.packKey);
});

ipc.on('show-group-via-link', (_event, info) => {
  strictAssert(typeof info.value === 'string', 'Got an invalid value over IPC');
  drop(window.Events.showGroupViaLink?.(info.value));
});

ipc.on('start-call-lobby', (_event, info) => {
  window.IPC.showWindow();
  window.Events.startCallingLobbyViaToken(info.token);
});

ipc.on('start-call-link', (_event, { key, epoch }) => {
  window.reduxActions?.calling?.startCallLinkLobby({
    rootKey: key,
    epoch,
  });
});

ipc.on('show-window', () => {
  window.IPC.showWindow();
});

ipc.on('cancel-presenting', () => {
  window.reduxActions?.calling?.cancelPresenting();
});

ipc.on('donation-validation-complete', (_event, { token }) => {
  drop(finish3dsValidation(token));
});

ipc.on('show-conversation-via-token', (_event, token: string) => {
  const { showConversationViaToken } = window.Events;
  if (showConversationViaToken) {
    void showConversationViaToken(token);
  }
});
ipc.on('show-conversation-via-signal.me', (_event, info) => {
  const { kind, value } = info;
  strictAssert(typeof kind === 'string', 'Got an invalid kind over IPC');
  strictAssert(typeof value === 'string', 'Got an invalid value over IPC');

  const { showConversationViaSignalDotMe } = window.Events;
  if (showConversationViaSignalDotMe) {
    void showConversationViaSignalDotMe(kind, value);
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

ipc.on('maybe-request-close-confirmation', async () => {
  const { getIsInCall, requestCloseConfirmation } = window.Events;
  if (!getIsInCall || !getIsInCall() || !requestCloseConfirmation) {
    ipc.send('received-close-confirmation', true);
    return;
  }

  log.info('Requesting close confirmation.');
  ipc.send('requested-close-confirmation');
  const result = await requestCloseConfirmation();
  ipc.send('received-close-confirmation', result);
});

ipc.on('show-release-notes', () => {
  const { showReleaseNotes } = window.Events;
  if (showReleaseNotes) {
    showReleaseNotes();
  }
});

ipc.on('sql-error', () => {
  if (!window.reduxActions) {
    return;
  }

  if (isProduction(window.getVersion())) {
    return;
  }

  window.reduxActions.toast.showToast({
    toastType: ToastType.SQLError,
  });
});

let untoastedMainProcessErrorLogCount = 0;
let untoastedMainProcessErrorLogs: Array<string> = [];
const MAX_MAIN_PROCESS_ERROR_LOGS_TO_CACHE = 5;

ipc.on('logging-error', (_event, logLine) => {
  if (isProduction(window.getVersion())) {
    return;
  }

  if (!isEnabled('desktop.loggingErrorToasts')) {
    return;
  }

  untoastedMainProcessErrorLogCount += 1;
  const numCached = untoastedMainProcessErrorLogs.unshift(logLine);
  if (numCached > MAX_MAIN_PROCESS_ERROR_LOGS_TO_CACHE) {
    untoastedMainProcessErrorLogs.pop();
  }

  throttledHandleMainProcessErrors();
});

const throttledHandleMainProcessErrors = throttle(
  _handleMainProcessErrors,
  5000
);

function _handleMainProcessErrors() {
  if (!window.reduxActions) {
    // Try again in a bit!
    throttledHandleMainProcessErrors();
    return;
  }

  if (untoastedMainProcessErrorLogs.length === 0) {
    return;
  }

  window.reduxActions.toast.showToast({
    toastType: ToastType._InternalMainProcessLoggingError,
    parameters: {
      count: untoastedMainProcessErrorLogCount,
      logLines: untoastedMainProcessErrorLogs,
    },
  });

  untoastedMainProcessErrorLogCount = 0;
  untoastedMainProcessErrorLogs = [];
}

ipc.on(
  'art-creator:uploadStickerPack',
  async (
    event,
    {
      manifest,
      stickers,
    }: { manifest: Uint8Array; stickers: ReadonlyArray<Uint8Array> }
  ) => {
    const packId = await window.Events?.uploadStickerPack(manifest, stickers);

    event.sender.send('art-creator:uploadStickerPack:done', packId);
  }
);

const { promise: windowVisible, resolve: resolveWindowVisible } =
  explodePromise<void>();

ipc.on('activate', () => {
  resolveWindowVisible();
});

async function whenWindowVisible(): Promise<void> {
  await windowVisible;
}
