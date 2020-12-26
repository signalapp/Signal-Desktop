// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, window */

/* eslint-disable global-require, no-inner-declarations */

try {
  const electron = require('electron');
  const semver = require('semver');
  const curve = require('curve25519-n');
  const _ = require('lodash');
  const { installGetter, installSetter } = require('./preload_utils');

  const { remote } = electron;
  const { app } = remote;
  const { nativeTheme } = remote.require('electron');

  window.PROTO_ROOT = 'protos';
  const config = require('url').parse(window.location.toString(), true).query;

  let title = config.name;
  if (config.environment !== 'production') {
    title += ` - ${config.environment}`;
  }
  if (config.appInstance) {
    title += ` - ${config.appInstance}`;
  }

  window.platform = process.platform;
  window.getTitle = () => title;
  window.getEnvironment = () => config.environment;
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

  // We never do these in our code, so we'll prevent it everywhere
  window.open = () => null;
  // eslint-disable-next-line no-eval, no-multi-assign
  window.eval = global.eval = () => null;

  window.drawAttention = () => {
    window.log.info('draw attention');
    ipc.send('draw-attention');
  };
  window.showWindow = () => {
    window.log.info('show window');
    ipc.send('show-window');
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

  ipc.on('set-up-as-new-device', () => {
    Whisper.events.trigger('setupAsNewDevice');
  });

  ipc.on('set-up-as-standalone', () => {
    Whisper.events.trigger('setupAsStandalone');
  });

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

  installGetter('auto-substitute-ascii-emojis', 'getAutoSubstituteAsciiEmojis');
  installSetter('auto-substitute-ascii-emojis', 'setAutoSubstituteAsciiEmojis');

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

  ipc.on('delete-all-data', () => {
    const { deleteAllData } = window.Events;
    if (deleteAllData) {
      deleteAllData();
    }
  });

  ipc.on('show-sticker-pack', (_event, info) => {
    const { packId, packKey } = info;
    const { showStickerPack } = window.Events;
    if (showStickerPack) {
      showStickerPack(packId, packKey);
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

  require('./js/logging');

  if (config.proxyUrl) {
    window.log.info('Using provided proxy url');
  }

  window.nodeSetImmediate = setImmediate;

  window.textsecure = require('./ts/textsecure').default;

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
  window.Backbone = require('backbone');

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

  // these need access to window.Signal:
  require('./ts/models/messages');
  require('./ts/models/conversations');

  function wrapWithPromise(fn) {
    return (...args) => Promise.resolve(fn(...args));
  }
  const externalCurve = {
    generateKeyPair: () => {
      const { privKey, pubKey } = curve.generateKeyPair();

      return {
        privKey: window.Signal.Crypto.typedArrayToArrayBuffer(privKey),
        pubKey: window.Signal.Crypto.typedArrayToArrayBuffer(pubKey),
      };
    },
    createKeyPair: incomingKey => {
      const incomingKeyBuffer = Buffer.from(incomingKey);
      const { privKey, pubKey } = curve.createKeyPair(incomingKeyBuffer);

      return {
        privKey: window.Signal.Crypto.typedArrayToArrayBuffer(privKey),
        pubKey: window.Signal.Crypto.typedArrayToArrayBuffer(pubKey),
      };
    },
    calculateAgreement: (pubKey, privKey) => {
      const pubKeyBuffer = Buffer.from(pubKey);
      const privKeyBuffer = Buffer.from(privKey);

      const buffer = curve.calculateAgreement(pubKeyBuffer, privKeyBuffer);

      return window.Signal.Crypto.typedArrayToArrayBuffer(buffer);
    },
    verifySignature: (pubKey, message, signature) => {
      const pubKeyBuffer = Buffer.from(pubKey);
      const messageBuffer = Buffer.from(message);
      const signatureBuffer = Buffer.from(signature);

      const result = curve.verifySignature(
        pubKeyBuffer,
        messageBuffer,
        signatureBuffer
      );

      return result;
    },
    calculateSignature: (privKey, message) => {
      const privKeyBuffer = Buffer.from(privKey);
      const messageBuffer = Buffer.from(message);

      const buffer = curve.calculateSignature(privKeyBuffer, messageBuffer);

      return window.Signal.Crypto.typedArrayToArrayBuffer(buffer);
    },
    validatePubKeyFormat: pubKey => {
      const pubKeyBuffer = Buffer.from(pubKey);

      return curve.validatePubKeyFormat(pubKeyBuffer);
    },
  };
  externalCurve.ECDHE = externalCurve.calculateAgreement;
  externalCurve.Ed25519Sign = externalCurve.calculateSignature;
  externalCurve.Ed25519Verify = externalCurve.verifySignature;
  const externalCurveAsync = {
    generateKeyPair: wrapWithPromise(externalCurve.generateKeyPair),
    createKeyPair: wrapWithPromise(externalCurve.createKeyPair),
    calculateAgreement: wrapWithPromise(externalCurve.calculateAgreement),
    verifySignature: async (...args) => {
      // The async verifySignature function has a different signature than the
      //   sync function
      const verifyFailed = externalCurve.verifySignature(...args);
      if (verifyFailed) {
        throw new Error('Invalid signature');
      }
    },
    calculateSignature: wrapWithPromise(externalCurve.calculateSignature),
    validatePubKeyFormat: wrapWithPromise(externalCurve.validatePubKeyFormat),
    ECDHE: wrapWithPromise(externalCurve.ECDHE),
    Ed25519Sign: wrapWithPromise(externalCurve.Ed25519Sign),
    Ed25519Verify: wrapWithPromise(externalCurve.Ed25519Verify),
  };
  window.libsignal = window.libsignal || {};
  window.libsignal.externalCurve = externalCurve;
  window.libsignal.externalCurveAsync = externalCurveAsync;

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
    // This is a hack to let us run TypeScript tests in the renderer process. See the
    //   code in `test/index.html`.
    const pendingDescribeCalls = [];
    window.describe = (...args) => {
      pendingDescribeCalls.push(args);
    };

    /* eslint-disable global-require, import/no-extraneous-dependencies */
    const fastGlob = require('fast-glob');

    fastGlob
      .sync('./ts/test-{both,electron}/**/*_test.js', {
        absolute: true,
        cwd: __dirname,
      })
      .forEach(require);

    delete window.describe;

    window.test = {
      pendingDescribeCalls,
      fastGlob,
      normalizePath: require('normalize-path'),
      fse: require('fs-extra'),
      tmp: require('tmp'),
      path: require('path'),
      basePath: __dirname,
      attachmentsPath: window.Signal.Migrations.attachmentsPath,
    };
    /* eslint-enable global-require, import/no-extraneous-dependencies */
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

window.log.info('preload complete');
