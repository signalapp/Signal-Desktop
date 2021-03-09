// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, window */

/* eslint-disable global-require, no-inner-declarations */

const preloadStartTime = Date.now();
let preloadEndTime = 0;

try {
  const electron = require('electron');
  const semver = require('semver');
  const _ = require('lodash');
  const { installGetter, installSetter } = require('./preload_utils');
  const {
    getEnvironment,
    setEnvironment,
    parseEnvironment,
    Environment,
  } = require('./ts/environment');

  const { remote } = electron;
  const { app } = remote;
  const { nativeTheme } = remote.require('electron');

  window.sqlInitializer = require('./ts/sql/initialize');

  window.PROTO_ROOT = 'protos';
  const config = require('url').parse(window.location.toString(), true).query;

  setEnvironment(parseEnvironment(config.environment));

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

  window.platform = process.platform;
  window.getTitle = () => title;
  window.getLocale = () => config.locale;
  window.getEnvironment = getEnvironment;
  window.getAppInstance = () => config.appInstance;
  window.getVersion = () => config.version;
  window.getExpiration = () => {
    const remoteBuildExpiration = window.storage.get('remoteBuildExpiration');
    if (remoteBuildExpiration) {
      return remoteBuildExpiration < config.buildExpiration
        ? remoteBuildExpiration
        : config.buildExpiration;
    }
    return config.buildExpiration;
  };
  window.getNodeVersion = () => config.node_version;
  window.getHostName = () => config.hostname;
  window.getServerTrustRoot = () => config.serverTrustRoot;
  window.getServerPublicParams = () => config.serverPublicParams;
  window.getSfuUrl = () => config.sfuUrl;
  window.isBehindProxy = () => Boolean(config.proxyUrl);
  window.getAutoLaunch = () => app.getLoginItemSettings().openAtLogin;
  window.setAutoLaunch = value => {
    app.setLoginItemSettings({ openAtLogin: Boolean(value) });
  };

  function setSystemTheme() {
    window.systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }

  setSystemTheme();

  window.subscribeToSystemThemeChange = fn => {
    nativeTheme.on('updated', () => {
      setSystemTheme();
      fn();
    });
  };

  window.isBeforeVersion = (toCheck, baseVersion) => {
    try {
      return semver.lt(toCheck, baseVersion);
    } catch (error) {
      window.log.error(
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
      window.log.error(
        `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
        error && error.stack ? error.stack : error
      );
      return true;
    }
  };

  const ipc = electron.ipcRenderer;
  const localeMessages = ipc.sendSync('locale-data');

  window.setBadgeCount = count => ipc.send('set-badge-count', count);

  let connectStartTime = 0;

  window.logMessageReceiverConnect = () => {
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
  // eslint-disable-next-line no-eval, no-multi-assign
  window.eval = global.eval = () => null;

  window.captchaRequired = () => {
    window.log.info('CAPTCHA required');
    ipc.send('captcha-required');
  };

  window.drawAttention = () => {
    window.log.info('draw attention');
    ipc.send('draw-attention');
  };
  window.showWindow = () => {
    window.log.info('show window');
    ipc.send('show-window');
  };
  window.setSecureInput = enabled => {
    ipc.send('set-secure-input', enabled);
  };

  window.titleBarDoubleClick = () => {
    ipc.send('title-bar-double-click');
  };

  window.setAutoHideMenuBar = autoHide =>
    ipc.send('set-auto-hide-menu-bar', autoHide);

  window.setMenuBarVisibility = visibility =>
    ipc.send('set-menu-bar-visibility', visibility);

  window.restart = () => {
    window.log.info('restart');
    ipc.send('restart');
  };
  window.shutdown = () => {
    window.log.info('shutdown');
    ipc.send('shutdown');
  };

  window.closeAbout = () => ipc.send('close-about');
  window.readyForUpdates = () => ipc.send('ready-for-updates');

  window.updateTrayIcon = unreadCount =>
    ipc.send('update-tray-icon', unreadCount);

  ipc.on('captcha-response', (_event, token) => {
    window.textsecure.storage.put('captchaToken', token);
    window.owsDesktopApp.appView.standaloneView.requestPendingVerification();
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
  window.showPermissionsPopup = () => ipc.send('show-permissions-popup');
  window.showCallingPermissionsPopup = forCamera =>
    ipc.invoke('show-calling-permissions-popup', forCamera);

  ipc.on('show-keyboard-shortcuts', () => {
    window.Events.showKeyboardShortcuts();
  });
  ipc.on('add-dark-overlay', () => {
    window.Events.addDarkOverlay();
  });
  ipc.on('remove-dark-overlay', () => {
    window.Events.removeDarkOverlay();
  });

  installGetter('device-name', 'getDeviceName');

  installGetter('theme-setting', 'getThemeSetting');
  installSetter('theme-setting', 'setThemeSetting');
  installGetter('hide-menu-bar', 'getHideMenuBar');
  installSetter('hide-menu-bar', 'setHideMenuBar');

  installGetter('notification-setting', 'getNotificationSetting');
  installSetter('notification-setting', 'setNotificationSetting');
  installGetter('notification-draw-attention', 'getNotificationDrawAttention');
  installSetter('notification-draw-attention', 'setNotificationDrawAttention');
  installGetter('audio-notification', 'getAudioNotification');
  installSetter('audio-notification', 'setAudioNotification');
  installGetter(
    'badge-count-muted-conversations',
    'getCountMutedConversations'
  );
  installSetter(
    'badge-count-muted-conversations',
    'setCountMutedConversations'
  );

  window.getCountMutedConversations = () =>
    new Promise((resolve, reject) => {
      ipc.once(
        'get-success-badge-count-muted-conversations',
        (_event, error, value) => {
          if (error) {
            return reject(new Error(error));
          }

          return resolve(value);
        }
      );
      ipc.send('get-badge-count-muted-conversations');
    });

  installGetter('spell-check', 'getSpellCheck');
  installSetter('spell-check', 'setSpellCheck');

  installGetter('auto-launch', 'getAutoLaunch');
  installSetter('auto-launch', 'setAutoLaunch');

  installGetter('always-relay-calls', 'getAlwaysRelayCalls');
  installSetter('always-relay-calls', 'setAlwaysRelayCalls');

  installGetter('call-ringtone-notification', 'getCallRingtoneNotification');
  installSetter('call-ringtone-notification', 'setCallRingtoneNotification');

  window.getCallRingtoneNotification = () =>
    new Promise((resolve, reject) => {
      ipc.once(
        'get-success-call-ringtone-notification',
        (_event, error, value) => {
          if (error) {
            return reject(new Error(error));
          }

          return resolve(value);
        }
      );
      ipc.send('get-call-ringtone-notification');
    });

  installGetter('call-system-notification', 'getCallSystemNotification');
  installSetter('call-system-notification', 'setCallSystemNotification');

  window.getCallSystemNotification = () =>
    new Promise((resolve, reject) => {
      ipc.once(
        'get-success-call-system-notification',
        (_event, error, value) => {
          if (error) {
            return reject(new Error(error));
          }

          return resolve(value);
        }
      );
      ipc.send('get-call-system-notification');
    });

  installGetter('incoming-call-notification', 'getIncomingCallNotification');
  installSetter('incoming-call-notification', 'setIncomingCallNotification');

  window.getIncomingCallNotification = () =>
    new Promise((resolve, reject) => {
      ipc.once(
        'get-success-incoming-call-notification',
        (_event, error, value) => {
          if (error) {
            return reject(new Error(error));
          }

          return resolve(value);
        }
      );
      ipc.send('get-incoming-call-notification');
    });

  window.getAlwaysRelayCalls = () =>
    new Promise((resolve, reject) => {
      ipc.once('get-success-always-relay-calls', (_event, error, value) => {
        if (error) {
          return reject(new Error(error));
        }

        return resolve(value);
      });
      ipc.send('get-always-relay-calls');
    });

  window.getMediaPermissions = () =>
    new Promise((resolve, reject) => {
      ipc.once('get-success-media-permissions', (_event, error, value) => {
        if (error) {
          return reject(new Error(error));
        }

        return resolve(value);
      });
      ipc.send('get-media-permissions');
    });

  window.getMediaCameraPermissions = () =>
    new Promise((resolve, reject) => {
      ipc.once(
        'get-success-media-camera-permissions',
        (_event, error, value) => {
          if (error) {
            return reject(new Error(error));
          }

          return resolve(value);
        }
      );
      ipc.send('get-media-camera-permissions');
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

  installGetter('is-primary', 'isPrimary');
  installGetter('sync-request', 'getSyncRequest');
  installGetter('sync-time', 'getLastSyncTime');
  installSetter('sync-time', 'setLastSyncTime');

  ipc.on('delete-all-data', async () => {
    const { deleteAllData } = window.Events;
    if (!deleteAllData) {
      return;
    }

    try {
      await deleteAllData();
    } catch (error) {
      window.log.error('delete-all-data: error', error && error.stack);
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
      window.log.error('preload shutdown handler: shutdown method not found');
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

  window.addSetupMenuItems = () => ipc.send('add-setup-menu-items');
  window.removeSetupMenuItems = () => ipc.send('remove-setup-menu-items');

  // We pull these dependencies in now, from here, because they have Node.js dependencies

  require('./ts/logging/set_up_renderer_logging').initialize();

  if (config.proxyUrl) {
    window.log.info('Using provided proxy url');
  }

  window.nodeSetImmediate = setImmediate;

  window.Backbone = require('backbone');
  window.textsecure = require('./ts/textsecure').default;
  window.synchronousCrypto = require('./ts/util/synchronousCrypto');

  window.WebAPI = window.textsecure.WebAPI.initialize({
    url: config.serverUrl,
    storageUrl: config.storageUrl,
    directoryUrl: config.directoryUrl,
    directoryEnclaveId: config.directoryEnclaveId,
    directoryTrustAnchor: config.directoryTrustAnchor,
    cdnUrlObject: {
      0: config.cdnUrl0,
      2: config.cdnUrl2,
    },
    certificateAuthority: config.certificateAuthority,
    contentProxyUrl: config.contentProxyUrl,
    proxyUrl: config.proxyUrl,
    version: config.version,
  });

  // Linux seems to periodically let the event loop stop, so this is a global workaround
  setInterval(() => {
    window.nodeSetImmediate(() => {});
  }, 1000);

  const { autoOrientImage } = require('./js/modules/auto_orient_image');
  const { imageToBlurHash } = require('./ts/util/imageToBlurHash');
  const { isGroupCallingEnabled } = require('./ts/util/isGroupCallingEnabled');
  const { ActiveWindowService } = require('./ts/services/ActiveWindowService');

  window.autoOrientImage = autoOrientImage;
  window.dataURLToBlobSync = require('blueimp-canvas-to-blob');
  window.imageToBlurHash = imageToBlurHash;
  window.emojiData = require('emoji-datasource');
  window.filesize = require('filesize');
  window.libphonenumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
  window.libphonenumber.PhoneNumberFormat = require('google-libphonenumber').PhoneNumberFormat;
  window.loadImage = require('blueimp-load-image');
  window.getGuid = require('uuid/v4');
  window.isGroupCallingEnabled = isGroupCallingEnabled;

  const activeWindowService = new ActiveWindowService();
  activeWindowService.initialize(window.document, ipc);
  window.isActive = activeWindowService.isActive.bind(activeWindowService);
  window.registerForActive = activeWindowService.registerForActive.bind(
    activeWindowService
  );
  window.unregisterForActive = activeWindowService.unregisterForActive.bind(
    activeWindowService
  );

  window.Accessibility = {
    reducedMotionSetting: Boolean(config.reducedMotionSetting),
  };

  window.isValidGuid = maybeGuid =>
    /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(
      maybeGuid
    );
  // https://stackoverflow.com/a/23299989
  window.isValidE164 = maybeE164 => /^\+?[1-9]\d{1,14}$/.test(maybeE164);

  window.normalizeUuids = (obj, paths, context) => {
    if (!obj) {
      return;
    }
    paths.forEach(path => {
      const val = _.get(obj, path);
      if (val) {
        if (!val || !window.isValidGuid(val)) {
          window.log.warn(
            `Normalizing invalid uuid: ${val} at path ${path} in context "${context}"`
          );
        }
        if (val && val.toLowerCase) {
          _.set(obj, path, val.toLowerCase());
        }
      }
    });
  };

  window.React = require('react');
  window.ReactDOM = require('react-dom');
  window.moment = require('moment');
  window.PQueue = require('p-queue').default;

  const Signal = require('./js/modules/signal');
  const i18n = require('./js/modules/i18n');
  const Attachments = require('./app/attachments');

  const { locale } = config;
  window.i18n = i18n.setup(locale, localeMessages);
  window.moment.updateLocale(locale, {
    relativeTime: {
      s: window.i18n('timestamp_s'),
      m: window.i18n('timestamp_m'),
      h: window.i18n('timestamp_h'),
    },
  });
  window.moment.locale(locale);

  const userDataPath = app.getPath('userData');
  window.baseAttachmentsPath = Attachments.getPath(userDataPath);
  window.baseStickersPath = Attachments.getStickersPath(userDataPath);
  window.baseTempPath = Attachments.getTempPath(userDataPath);
  window.baseDraftPath = Attachments.getDraftPath(userDataPath);
  window.Signal = Signal.setup({
    Attachments,
    userDataPath,
    getRegionCode: () => window.storage.get('regionCode'),
    logger: window.log,
  });
  window.CI = config.enableCI
    ? {
        setProvisioningURL: url => ipc.send('set-provisioning-url', url),
        deviceName: title,
      }
    : undefined;

  // these need access to window.Signal:
  require('./ts/models/messages');
  require('./ts/models/conversations');

  require('./ts/backbone/views/whisper_view');
  require('./ts/backbone/views/toast_view');
  require('./ts/views/conversation_view');
  require('./ts/SignalProtocolStore');
  require('./ts/background');

  // Pulling these in separately since they access filesystem, electron
  window.Signal.Backup = require('./js/modules/backup');
  window.Signal.Debug = require('./js/modules/debug');
  window.Signal.Logs = require('./js/modules/logs');

  window.addEventListener('contextmenu', e => {
    const editable = e.target.closest(
      'textarea, input, [contenteditable="true"]'
    );
    const link = e.target.closest('a');
    const selection = Boolean(window.getSelection().toString());
    const image = e.target.closest('.module-lightbox img');
    if (!editable && !selection && !link && !image) {
      e.preventDefault();
    }
  });

  if (config.environment === 'test') {
    require('./preload_test.js');
  }
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
window.log.info('preload complete');
