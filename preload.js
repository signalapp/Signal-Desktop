// Copyright 2017-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, window */

/* eslint-disable global-require, no-inner-declarations */

const preloadStartTime = Date.now();
let preloadEndTime = 0;

try {
  const electron = require('electron');
  const semver = require('semver');
  const _ = require('lodash');
  const { strictAssert } = require('./ts/util/assert');
  const { parseIntWithFallback } = require('./ts/util/parseIntWithFallback');
  const { UUIDKind } = require('./ts/types/UUID');

  // It is important to call this as early as possible
  const { SignalContext } = require('./ts/windows/context');
  window.i18n = SignalContext.i18n;

  const { getEnvironment, Environment } = require('./ts/environment');
  const ipc = electron.ipcRenderer;

  const config = require('url').parse(window.location.toString(), true).query;

  const log = require('./ts/logging/log');

  let title = config.name;
  if (getEnvironment() !== Environment.Production) {
    title += ` - ${getEnvironment()}`;
  }
  if (config.appInstance) {
    title += ` - ${config.appInstance}`;
  }

  // Flags for testing
  window.GV2_ENABLE_SINGLE_CHANGE_PROCESSING = true;
  window.GV2_ENABLE_CHANGE_PROCESSING = true;
  window.GV2_ENABLE_STATE_PROCESSING = true;

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
    const localBuildExpiration = window.Events.getAutoDownloadUpdate()
      ? config.buildExpiration
      : config.buildExpiration - sixtyDays;

    if (remoteBuildExpiration) {
      return remoteBuildExpiration < config.buildExpiration
        ? remoteBuildExpiration
        : localBuildExpiration;
    }
    return localBuildExpiration;
  };
  window.getHostName = () => config.hostname;
  window.getServerTrustRoot = () => config.serverTrustRoot;
  window.getServerPublicParams = () => config.serverPublicParams;
  window.getSfuUrl = () => config.sfuUrl;
  window.isBehindProxy = () => Boolean(config.proxyUrl);
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

  let connectStartTime = 0;

  window.logAuthenticatedConnect = () => {
    if (connectStartTime === 0) {
      connectStartTime = Date.now();
    }
  };

  window.logAppLoadedEvent = ({ processedCount }) =>
    ipc.send('signal-app-loaded', {
      preloadTime: preloadEndTime - preloadStartTime,
      connectTime: connectStartTime - preloadEndTime,
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
      remoteConfig: _.mapValues(remoteConfig, ({ value, enabled }) => {
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
    Whisper.events.trigger('setupAsNewDevice');
  });

  ipc.on('set-up-as-standalone', () => {
    Whisper.events.trigger('setupAsStandalone');
  });

  ipc.on('challenge:response', (_event, response) => {
    Whisper.events.trigger('challengeResponse', response);
  });

  ipc.on('power-channel:suspend', () => {
    Whisper.events.trigger('powerMonitorSuspend');
  });

  ipc.on('power-channel:resume', () => {
    Whisper.events.trigger('powerMonitorResume');
  });

  ipc.on('power-channel:lock-screen', () => {
    Whisper.events.trigger('powerMonitorLockScreen');
  });

  window.sendChallengeRequest = request =>
    ipc.send('challenge:request', request);

  {
    let isFullScreen = config.isFullScreen === 'true';

    window.isFullScreen = () => isFullScreen;
    // This is later overwritten.
    window.onFullScreenChange = _.noop;

    ipc.on('full-screen-change', (_event, isFull) => {
      isFullScreen = Boolean(isFull);
      window.onFullScreenChange(isFullScreen);
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

  require('./ts/windows/preload');

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

  // We pull these dependencies in now, from here, because they have Node.js dependencies

  if (config.proxyUrl) {
    log.info('Using provided proxy url');
  }

  window.nodeSetImmediate = setImmediate;

  window.Backbone = require('backbone');
  window.textsecure = require('./ts/textsecure').default;

  window.WebAPI = window.textsecure.WebAPI.initialize({
    url: config.serverUrl,
    storageUrl: config.storageUrl,
    updatesUrl: config.updatesUrl,
    directoryVersion: parseInt(config.directoryVersion, 10),
    directoryUrl: config.directoryUrl,
    directoryEnclaveId: config.directoryEnclaveId,
    directoryTrustAnchor: config.directoryTrustAnchor,
    directoryV2Url: config.directoryV2Url,
    directoryV2PublicKey: config.directoryV2PublicKey,
    directoryV2CodeHashes: (config.directoryV2CodeHashes || '').split(','),
    cdnUrlObject: {
      0: config.cdnUrl0,
      2: config.cdnUrl2,
    },
    certificateAuthority: config.certificateAuthority,
    contentProxyUrl: config.contentProxyUrl,
    proxyUrl: config.proxyUrl,
    version: config.version,
  });

  const { imageToBlurHash } = require('./ts/util/imageToBlurHash');
  const { ActiveWindowService } = require('./ts/services/ActiveWindowService');

  window.imageToBlurHash = imageToBlurHash;
  window.libphonenumber =
    require('google-libphonenumber').PhoneNumberUtil.getInstance();
  window.libphonenumber.PhoneNumberFormat =
    require('google-libphonenumber').PhoneNumberFormat;

  const activeWindowService = new ActiveWindowService();
  activeWindowService.initialize(window.document, ipc);
  window.isActive = activeWindowService.isActive.bind(activeWindowService);
  window.registerForActive =
    activeWindowService.registerForActive.bind(activeWindowService);
  window.unregisterForActive =
    activeWindowService.unregisterForActive.bind(activeWindowService);

  window.Accessibility = {
    reducedMotionSetting: Boolean(config.reducedMotionSetting),
  };

  window.React = require('react');
  window.ReactDOM = require('react-dom');

  window.moment = require('moment');
  require('moment/min/locales.min');

  window.PQueue = require('p-queue').default;

  const Signal = require('./js/modules/signal');
  const Attachments = require('./ts/windows/attachments');

  const { locale } = config;
  window.moment.updateLocale(locale, {
    relativeTime: {
      s: window.i18n('timestamp_s'),
      m: window.i18n('timestamp_m'),
      h: window.i18n('timestamp_h'),
    },
  });
  window.moment.locale(locale);

  const userDataPath = SignalContext.getPath('userData');
  window.baseAttachmentsPath = Attachments.getPath(userDataPath);
  window.baseStickersPath = Attachments.getStickersPath(userDataPath);
  window.baseTempPath = Attachments.getTempPath(userDataPath);
  window.baseDraftPath = Attachments.getDraftPath(userDataPath);

  const { addSensitivePath } = require('./ts/util/privacy');

  addSensitivePath(window.baseAttachmentsPath);
  if (config.crashDumpsPath) {
    addSensitivePath(config.crashDumpsPath);
  }

  window.Signal = Signal.setup({
    Attachments,
    userDataPath,
    getRegionCode: () => window.storage.get('regionCode'),
    logger: log,
  });

  if (config.enableCI) {
    const { CI } = require('./ts/CI');
    window.CI = new CI(title);
  }

  // these need access to window.Signal:
  require('./ts/models/messages');
  require('./ts/models/conversations');

  require('./ts/backbone/views/whisper_view');
  require('./ts/views/conversation_view');
  require('./ts/views/inbox_view');
  require('./ts/SignalProtocolStore');
  require('./ts/background');

  // Pulling these in separately since they access filesystem, electron
  window.Signal.Debug = require('./js/modules/debug');

  window.addEventListener('contextmenu', e => {
    const editable = e.target.closest(
      'textarea, input, [contenteditable="true"]'
    );
    const link = e.target.closest('a');
    const selection = Boolean(window.getSelection().toString());
    const image = e.target.closest('.Lightbox img');
    if (!editable && !selection && !link && !image) {
      e.preventDefault();
    }
  });

  if (config.environment === 'test') {
    require('./preload_test');
  }
  log.info('preload complete');
} catch (error) {
  /* eslint-disable no-console */
  if (console._log) {
    console._log('preload error!', error.stack);
  } else {
    console.log('preload error!', error.stack);
  }
  /* eslint-enable no-console */

  throw error;
}

preloadEndTime = Date.now();
