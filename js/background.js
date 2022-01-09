/* global
  $,
  _,
  Backbone,
  storage,
  Whisper,
  BlockedNumberController,
  Signal
*/

// eslint-disable-next-line func-names
(async function() {
  'use strict';

  // Globally disable drag and drop
  document.body.addEventListener(
    'dragover',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );
  document.body.addEventListener(
    'drop',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );

  // Load these images now to ensure that they don't flicker on first use
  const images = [];
  function preload(list) {
    for (let index = 0, max = list.length; index < max; index += 1) {
      const image = new Image();
      image.src = `./images/${list[index]}`;
      images.push(image);
    }
  }
  preload([
    'alert-outline.svg',
    'check.svg',
    'error.svg',
    'file-gradient.svg',
    'file.svg',
    'image.svg',
    'microphone.svg',
    'movie.svg',
    'open_link.svg',
    'play.svg',
    'save.svg',
    'shield.svg',
    'timer.svg',
    'video.svg',
    'warning.svg',
    'x.svg',
  ]);

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;
  window.globalOnlineStatus = true; // default to true as we don't get an event on app start
  window.getGlobalOnlineStatus = () => window.globalOnlineStatus;

  window.log.info('background page reloaded');
  window.log.info('environment:', window.getEnvironment());
  const restartReason = localStorage.getItem('restart-reason');

  if (restartReason === 'unlink') {
    setTimeout(() => {
      localStorage.removeItem('restart-reason');

      window.libsession.Utils.ToastUtils.pushForceUnlinked();
    }, 2000);
  }

  let initialLoadComplete = false;
  let newVersion = false;

  window.document.title = window.getTitle();

  Whisper.events = _.clone(Backbone.Events);
  Whisper.events.isListenedTo = eventName =>
    Whisper.events._events ? !!Whisper.events._events[eventName] : false;

  window.log.info('Storage fetch');
  storage.fetch();

  function mapOldThemeToNew(theme) {
    switch (theme) {
      case 'dark':
      case 'light':
        return theme;
      case 'android-dark':
        return 'dark';
      case 'android':
      case 'ios':
      default:
        return 'light';
    }
  }

  // We need this 'first' check because we don't want to start the app up any other time
  //   than the first time. And storage.fetch() will cause onready() to fire.
  let first = true;
  storage.onready(async () => {
    if (!first) {
      return;
    }
    first = false;

    // Update zoom
    window.updateZoomFactor();

    // Ensure accounts created prior to 1.0.0-beta8 do have their
    // 'primaryDevicePubKey' defined.
    if (Whisper.Registration.isDone() && !storage.get('primaryDevicePubKey', null)) {
      storage.put(
        'primaryDevicePubKey',
        window.libsession.Utils.UserUtils.getOurPubKeyStrFromCache()
      );
    }

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getThemeSetting: () => storage.get('theme-setting', 'light'),
      setThemeSetting: value => {
        storage.put('theme-setting', value);
      },
      getHideMenuBar: () => storage.get('hide-menu-bar'),
      setHideMenuBar: value => {
        storage.put('hide-menu-bar', value);
        window.setAutoHideMenuBar(false);
        window.setMenuBarVisibility(!value);
      },

      getSpellCheck: () => storage.get('spell-check', true),
      setSpellCheck: value => {
        storage.put('spell-check', value);
      },

      shutdown: async () => {
        // Stop background processing
        window.libsession.Utils.AttachmentDownloads.stop();

        // Stop processing incoming messages
        // FIXME audric stop polling opengroupv2 and swarm nodes

        // Shut down the data interface cleanly
        await window.Signal.Data.shutdown();
      },
    };

    const currentVersion = window.getVersion();
    const lastVersion = storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await storage.put('version', currentVersion);

    if (newVersion) {
      window.log.info(`New version detected: ${currentVersion}; previous: ${lastVersion}`);

      await window.Signal.Data.cleanupOrphanedAttachments();

      await window.Signal.Logs.deleteAll();
    }

    const themeSetting = window.Events.getThemeSetting();
    const newThemeSetting = mapOldThemeToNew(themeSetting);
    window.Events.setThemeSetting(newThemeSetting);

    try {
      await Promise.all([
        window.getConversationController().load(),
        BlockedNumberController.load(),
      ]);
    } catch (error) {
      window.log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      start();
    }
  });

  function manageExpiringData() {
    window.Signal.Data.cleanSeenMessages();
    window.Signal.Data.cleanLastHashes();
    setTimeout(manageExpiringData, 1000 * 60 * 60);
  }

  async function start() {
    manageExpiringData();
    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('Cleanup: starting...');

    const results = await Promise.all([window.Signal.Data.getOutgoingWithoutExpiresAt()]);

    // Combine the models
    const messagesForCleanup = results.reduce(
      (array, current) => array.concat(current.toArray()),
      []
    );

    window.log.info(`Cleanup: Found ${messagesForCleanup.length} messages for cleanup`);
    await Promise.all(
      messagesForCleanup.map(async message => {
        const sentAt = message.get('sent_at');

        if (message.hasErrors()) {
          return;
        }

        window.log.info(`Cleanup: Deleting unsent message ${sentAt}`);
        await window.Signal.Data.removeMessage(message.id);
      })
    );
    window.log.info('Cleanup: complete');

    window.log.info('listening for registration events');
    Whisper.events.on('registration_done', async () => {
      window.log.info('handling registration event');

      // Disable link previews as default per Kee
      storage.onready(async () => {
        storage.put('link-preview-setting', false);
      });

      connect(true);
    });

    const appView = new Whisper.AppView({
      el: $('body'),
    });

    Whisper.WallClockListener.init(Whisper.events);
    Whisper.ExpiringMessagesListener.init(Whisper.events);

    if (Whisper.Registration.isDone() && !window.textsecure.storage.user.isSignInByLinking()) {
      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else {
      appView.openStandalone();
    }

    Whisper.events.on('showDebugLog', () => {
      appView.openDebugLog();
    });

    window.addEventListener('focus', () => Whisper.Notifications.clear());
    window.addEventListener('unload', () => Whisper.Notifications.fastClear());

    // Set user's launch count.
    const prevLaunchCount = window.getSettingValue('launch-count');
    const launchCount = !prevLaunchCount ? 1 : prevLaunchCount + 1;
    window.setSettingValue('launch-count', launchCount);

    // On first launch
    if (launchCount === 1) {
      // Initialise default settings
      window.setSettingValue('hide-menu-bar', true);
      window.setSettingValue('link-preview-setting', false);
    }

    window.setTheme = newTheme => {
      window.Events.setThemeSetting(newTheme);
    };

    window.toggleMenuBar = () => {
      const current = window.getSettingValue('hide-menu-bar');
      if (current === undefined) {
        window.Events.setHideMenuBar(false);
        return;
      }

      window.Events.setHideMenuBar(!current);
    };

    window.toggleSpellCheck = () => {
      const currentValue = window.getSettingValue('spell-check');
      // if undefined, it means 'default' so true. but we have to toggle it, so false
      // if not undefined, we take the opposite
      const newValue = currentValue !== undefined ? !currentValue : false;
      window.Events.setSpellCheck(newValue);
      window.libsession.Utils.ToastUtils.pushRestartNeeded();
    };

    window.toggleMediaPermissions = async () => {
      const value = window.getMediaPermissions();

      if (value === true) {
        const valueCallPermissions = window.getCallMediaPermissions();
        if (valueCallPermissions) {
          window.log.info('toggleMediaPermissions : forcing callPermissions to false');

          window.toggleCallMediaPermissionsTo(false);
        }
      }

      if (value === false && Signal.OS.isMacOS()) {
        await window.askForMediaAccess();
      }
      window.setMediaPermissions(!value);
    };

    window.toggleCallMediaPermissionsTo = async enabled => {
      const previousValue = window.getCallMediaPermissions();
      if (previousValue === enabled) {
        return;
      }
      if (previousValue === false) {
        // value was false and we toggle it so we turn it on
        if (Signal.OS.isMacOS()) {
          await window.askForMediaAccess();
        }
        window.log.info('toggleCallMediaPermissionsTo : forcing audio/video to true');
        // turning ON "call permissions" forces turning on "audio/video permissions"
        window.setMediaPermissions(true);
      }
      window.setCallMediaPermissions(enabled);
    };

    Whisper.Notifications.on('click', async (id, messageId) => {
      window.showWindow();
      if (id) {
        await window.openConversationWithMessages({ conversationKey: id, messageId });
      } else {
        appView.openInbox({
          initialLoadComplete,
        });
      }
    });

    Whisper.events.on('openInbox', () => {
      appView.openInbox({
        initialLoadComplete,
      });
    });

    Whisper.events.on('password-updated', () => {
      if (appView && appView.inboxView) {
        appView.inboxView.trigger('password-updated');
      }
    });
  }

  let disconnectTimer = null;
  function onOffline() {
    window.log.info('offline');
    window.globalOnlineStatus = false;

    window.removeEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // We've received logs from Linux where we get an 'offline' event, then 30ms later
    //   we get an online event. This waits a bit after getting an 'offline' event
    //   before disconnecting the socket manually.
    disconnectTimer = setTimeout(disconnect, 1000);
  }

  function onOnline() {
    window.log.info('online');
    window.globalOnlineStatus = true;

    window.removeEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (disconnectTimer) {
      window.log.warn('Already online. Had a blip in online/offline status.');
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
      return;
    }
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    connect();
  }

  async function disconnect() {
    window.log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = null;
    window.libsession.Utils.AttachmentDownloads.stop();
  }

  let connectCount = 0;
  async function connect(firstRun) {
    window.log.info('connect');

    // Bootstrap our online/offline detection, only the first time we connect
    if (connectCount === 0 && navigator.onLine) {
      window.addEventListener('offline', onOffline);
    }
    if (connectCount === 0 && !navigator.onLine) {
      window.log.warn('Starting up offline; will connect when we have network access');
      window.addEventListener('online', onOnline);
      onEmpty(); // this ensures that the loading screen is dismissed
      return;
    }

    if (firstRun) {
      window.readyForUpdates();
    }

    if (!Whisper.Registration.everDone()) {
      return;
    }

    connectCount += 1;
    Whisper.Notifications.disable(); // avoid notification flood until empty
    setTimeout(() => {
      Whisper.Notifications.enable();
    }, 10 * 1000); // 10 sec

    window.NewReceiver.queueAllCached();
    window.libsession.Utils.AttachmentDownloads.start({
      logger: window.log,
    });

    window.textsecure.messaging = true;
  }

  function onEmpty() {
    initialLoadComplete = true;

    window.readyForUpdates();

    Whisper.Notifications.enable();
  }
})();
