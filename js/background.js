/* global
  $,
  _,
  Backbone,
  ConversationController,
  MessageController,
  getAccountManager,
  Signal,
  storage,
  textsecure,
  WebAPI
  Whisper,
*/

// eslint-disable-next-line func-names
(async function() {
  'use strict';

  const eventHandlerQueue = new window.PQueue({ concurrency: 1 });
  const deliveryReceiptQueue = new window.PQueue({
    concurrency: 1,
  });
  deliveryReceiptQueue.pause();
  const deliveryReceiptBatcher = window.Signal.Util.createBatcher({
    wait: 500,
    maxSize: 500,
    processBatch: async items => {
      const bySource = _.groupBy(items, item => item.source);
      const sources = Object.keys(bySource);

      for (let i = 0, max = sources.length; i < max; i += 1) {
        const source = sources[i];
        const timestamps = bySource[source].map(item => item.timestamp);

        try {
          const { wrap, sendOptions } = ConversationController.prepareForSend(
            source
          );
          // eslint-disable-next-line no-await-in-loop
          await wrap(
            textsecure.messaging.sendDeliveryReceipt(
              source,
              timestamps,
              sendOptions
            )
          );
        } catch (error) {
          window.log.error(
            `Failed to send delivery receipt to ${source} for timestamps ${timestamps}:`,
            error && error.stack ? error.stack : error
          );
        }
      }
    },
  });

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

  // Idle timer - you're active for ACTIVE_TIMEOUT after one of these events
  const ACTIVE_TIMEOUT = 15 * 1000;
  const ACTIVE_EVENTS = [
    'click',
    'keydown',
    'mousedown',
    'mousemove',
    // 'scroll', // this is triggered by Timeline re-renders, can't use
    'touchstart',
    'wheel',
  ];

  const LISTENER_DEBOUNCE = 5 * 1000;
  let activeHandlers = [];
  let activeTimestamp = Date.now();

  window.resetActiveTimer = _.throttle(() => {
    const previouslyActive = window.isActive();
    activeTimestamp = Date.now();
    if (!previouslyActive) {
      activeHandlers.forEach(handler => handler());
    }
  }, LISTENER_DEBOUNCE);

  ACTIVE_EVENTS.forEach(name => {
    document.addEventListener(name, window.resetActiveTimer, true);
  });

  window.isActive = () => {
    const now = Date.now();
    return window.isFocused() && now <= activeTimestamp + ACTIVE_TIMEOUT;
  };
  window.registerForActive = handler => activeHandlers.push(handler);
  window.unregisterForActive = handler => {
    activeHandlers = activeHandlers.filter(item => item !== handler);
  };

  // Keyboard/mouse mode
  let interactionMode = 'mouse';
  $(document.body).addClass('mouse-mode');

  window.enterKeyboardMode = () => {
    if (interactionMode === 'keyboard') {
      return;
    }

    interactionMode = 'keyboard';
    $(document.body)
      .addClass('keyboard-mode')
      .removeClass('mouse-mode');
    const { userChanged } = window.reduxActions.user;
    const { clearSelectedMessage } = window.reduxActions.conversations;
    if (clearSelectedMessage) {
      clearSelectedMessage();
    }
    if (userChanged) {
      userChanged({ interactionMode });
    }
  };
  window.enterMouseMode = () => {
    if (interactionMode === 'mouse') {
      return;
    }

    interactionMode = 'mouse';
    $(document.body)
      .addClass('mouse-mode')
      .removeClass('keyboard-mode');
    const { userChanged } = window.reduxActions.user;
    const { clearSelectedMessage } = window.reduxActions.conversations;
    if (clearSelectedMessage) {
      clearSelectedMessage();
    }
    if (userChanged) {
      userChanged({ interactionMode });
    }
  };

  document.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Tab') {
        window.enterKeyboardMode();
      }
    },
    true
  );
  document.addEventListener('wheel', window.enterMouseMode, true);
  document.addEventListener('mousedown', window.enterMouseMode, true);

  window.getInteractionMode = () => interactionMode;

  // Load these images now to ensure that they don't flicker on first use
  window.preloadedImages = [];
  function preload(list) {
    for (let index = 0, max = list.length; index < max; index += 1) {
      const image = new Image();
      image.src = `./images/${list[index]}`;
      window.preloadedImages.push(image);
    }
  }
  const builtInImages = await window.getBuiltInImages();
  preload(builtInImages);

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;

  const { IdleDetector, MessageDataMigrator } = Signal.Workflow;
  const {
    mandatoryMessageUpgrade,
    migrateAllToSQLCipher,
    removeDatabase,
    runMigrations,
    doesDatabaseExist,
  } = Signal.IndexedDB;
  const { Errors, Message } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    writeNewAttachmentData,
    deleteAttachmentData,
    doesAttachmentExist,
  } = window.Signal.Migrations;
  const { Views } = window.Signal;

  // Implicitly used in `indexeddb-backbonejs-adapter`:
  // https://github.com/signalapp/Signal-Desktop/blob/4033a9f8137e62ed286170ed5d4941982b1d3a64/components/indexeddb-backbonejs-adapter/backbone-indexeddb.js#L569
  window.onInvalidStateError = error =>
    window.log.error(error && error.stack ? error.stack : error);

  window.log.info('background page reloaded');
  window.log.info('environment:', window.getEnvironment());

  let idleDetector;
  let initialLoadComplete = false;
  let newVersion = false;

  window.owsDesktopApp = {};
  window.document.title = window.getTitle();

  Whisper.KeyChangeListener.init(textsecure.storage.protocol);
  textsecure.storage.protocol.on('removePreKey', () => {
    getAccountManager().refreshPreKeys();
  });

  let messageReceiver;
  window.getSocketStatus = () => {
    if (messageReceiver) {
      return messageReceiver.getStatus();
    }
    return -1;
  };
  Whisper.events = _.clone(Backbone.Events);
  let accountManager;
  window.getAccountManager = () => {
    if (!accountManager) {
      const USERNAME = storage.get('number_id');
      const PASSWORD = storage.get('password');
      accountManager = new textsecure.AccountManager(USERNAME, PASSWORD);
      accountManager.addEventListener('registration', () => {
        const user = {
          regionCode: window.storage.get('regionCode'),
          ourNumber: textsecure.storage.user.getNumber(),
        };
        Whisper.events.trigger('userChanged', user);

        Whisper.Registration.markDone();
        window.log.info('dispatching registration event');
        Whisper.events.trigger('registration_done');
      });
    }
    return accountManager;
  };

  const cancelInitializationMessage = Views.Initialization.setMessage();

  const version = await window.Signal.Data.getItemById('version');
  let isIndexedDBPresent = false;
  if (!version) {
    isIndexedDBPresent = await doesDatabaseExist();
    if (isIndexedDBPresent) {
      window.installStorage(window.legacyStorage);
      window.log.info('Start IndexedDB migrations');
      await runMigrations();
    }
  }

  window.log.info('Storage fetch');
  storage.fetch();

  function mapOldThemeToNew(theme) {
    switch (theme) {
      case 'dark':
      case 'light':
      case 'system':
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

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getDeviceName: () => textsecure.storage.user.getDeviceName(),

      getThemeSetting: () =>
        storage.get(
          'theme-setting',
          window.platform === 'darwin' ? 'system' : 'light'
        ),
      setThemeSetting: value => {
        storage.put('theme-setting', value);
        onChangeTheme();
      },
      getHideMenuBar: () => storage.get('hide-menu-bar'),
      setHideMenuBar: value => {
        storage.put('hide-menu-bar', value);
        window.setAutoHideMenuBar(value);
        window.setMenuBarVisibility(!value);
      },

      getNotificationSetting: () =>
        storage.get('notification-setting', 'message'),
      setNotificationSetting: value =>
        storage.put('notification-setting', value),
      getAudioNotification: () => storage.get('audio-notification'),
      setAudioNotification: value => storage.put('audio-notification', value),

      getSpellCheck: () => storage.get('spell-check', true),
      setSpellCheck: value => {
        storage.put('spell-check', value);
        startSpellCheck();
      },

      // eslint-disable-next-line eqeqeq
      isPrimary: () => textsecure.storage.user.getDeviceId() == '1',
      getSyncRequest: () =>
        new Promise((resolve, reject) => {
          const syncRequest = window.getSyncRequest();
          syncRequest.addEventListener('success', resolve);
          syncRequest.addEventListener('timeout', reject);
        }),
      getLastSyncTime: () => storage.get('synced_at'),
      setLastSyncTime: value => storage.put('synced_at', value),

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),
      showKeyboardShortcuts: () => window.showKeyboardShortcuts(),

      deleteAllData: () => {
        const clearDataView = new window.Whisper.ClearDataView().render();
        $('body').append(clearDataView.el);
      },

      shutdown: async () => {
        // Stop background processing
        window.Signal.AttachmentDownloads.stop();
        if (idleDetector) {
          idleDetector.stop();
        }

        // Stop processing incoming messages
        if (messageReceiver) {
          await messageReceiver.stopProcessing();
          await window.waitForAllBatchers();
        }

        if (messageReceiver) {
          messageReceiver.unregisterBatchers();
          messageReceiver = null;
        }

        // A number of still-to-queue database queries might be waiting inside batchers.
        //   We wait for these to empty first, and then shut down the data interface.
        await Promise.all([
          window.waitForAllBatchers(),
          window.waitForAllWaitBatchers(),
        ]);

        // Shut down the data interface cleanly
        await window.Signal.Data.shutdown();
      },

      showStickerPack: async (packId, key) => {
        // We can get these events even if the user has never linked this instance.
        if (Whisper.Import.isIncomplete() || !Whisper.Registration.everDone()) {
          return;
        }

        // Kick off the download
        window.Signal.Stickers.downloadEphemeralPack(packId, key);

        const props = {
          packId,
          onClose: async () => {
            stickerPreviewModalView.remove();
            await window.Signal.Stickers.removeEphemeralPack(packId);
          },
        };

        const stickerPreviewModalView = new Whisper.ReactWrapperView({
          className: 'sticker-preview-modal-wrapper',
          JSX: Signal.State.Roots.createStickerPreviewModal(
            window.reduxStore,
            props
          ),
        });
      },
    };

    if (isIndexedDBPresent) {
      await mandatoryMessageUpgrade({ upgradeMessageSchema });
      await migrateAllToSQLCipher({ writeNewAttachmentData, Views });
      await removeDatabase();
      try {
        await window.Signal.Data.removeIndexedDBFiles();
      } catch (error) {
        window.log.error(
          'Failed to remove IndexedDB files:',
          error && error.stack ? error.stack : error
        );
      }

      window.installStorage(window.newStorage);
      await window.storage.fetch();
      await storage.put('indexeddb-delete-needed', true);
    }

    // How long since we were last running?
    const now = Date.now();
    const lastHeartbeat = storage.get('lastHeartbeat');
    await storage.put('lastStartup', Date.now());

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (lastHeartbeat > 0 && now - lastHeartbeat > THIRTY_DAYS) {
      await unlinkAndDisconnect();
    }

    // Start heartbeat timer
    storage.put('lastHeartbeat', Date.now());
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    setInterval(() => storage.put('lastHeartbeat', Date.now()), TWELVE_HOURS);

    const currentVersion = window.getVersion();
    const lastVersion = storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await storage.put('version', currentVersion);

    if (newVersion && lastVersion) {
      window.log.info(
        `New version detected: ${currentVersion}; previous: ${lastVersion}`
      );

      const themeSetting = window.Events.getThemeSetting();
      const newThemeSetting = mapOldThemeToNew(themeSetting);

      if (
        window.isBeforeVersion(lastVersion, 'v1.25.0') &&
        window.platform === 'darwin' &&
        newThemeSetting === window.systemTheme
      ) {
        window.Events.setThemeSetting('system');
      } else {
        window.Events.setThemeSetting(newThemeSetting);
      }

      if (window.isBeforeVersion(lastVersion, 'v1.25.0')) {
        // Stickers flags
        await Promise.all([
          storage.put('showStickersIntroduction', true),
          storage.put('showStickerPickerHint', true),
        ]);
      }

      if (window.isBeforeVersion(lastVersion, 'v1.26.0')) {
        // Ensure that we re-register our support for sealed sender
        await storage.put(
          'hasRegisterSupportForUnauthenticatedDelivery',
          false
        );
      }

      // This one should always be last - it could restart the app
      if (window.isBeforeVersion(lastVersion, 'v1.15.0-beta.5')) {
        await window.Signal.Logs.deleteAll();
        window.restart();
        return;
      }
    }

    Views.Initialization.setMessage(window.i18n('optimizingApplication'));

    if (newVersion) {
      await window.Signal.Data.cleanupOrphanedAttachments();
    }

    Views.Initialization.setMessage(window.i18n('loading'));

    idleDetector = new IdleDetector();
    let isMigrationWithIndexComplete = false;
    window.log.info(
      `Starting background data migration. Target version: ${
        Message.CURRENT_SCHEMA_VERSION
      }`
    );
    idleDetector.on('idle', async () => {
      const NUM_MESSAGES_PER_BATCH = 1;

      if (!isMigrationWithIndexComplete) {
        const batchWithIndex = await MessageDataMigrator.processNext({
          BackboneMessage: Whisper.Message,
          BackboneMessageCollection: Whisper.MessageCollection,
          numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
          upgradeMessageSchema,
          getMessagesNeedingUpgrade:
            window.Signal.Data.getMessagesNeedingUpgrade,
          saveMessage: window.Signal.Data.saveMessage,
        });
        window.log.info('Upgrade message schema (with index):', batchWithIndex);
        isMigrationWithIndexComplete = batchWithIndex.done;
      }

      if (isMigrationWithIndexComplete) {
        window.log.info(
          'Background migration complete. Stopping idle detector.'
        );
        idleDetector.stop();
      }
    });

    const startSpellCheck = () => {
      if (!window.enableSpellCheck || !window.disableSpellCheck) {
        return;
      }

      if (window.Events.getSpellCheck()) {
        window.enableSpellCheck();
      } else {
        window.disableSpellCheck();
      }
    };
    startSpellCheck();

    try {
      await Promise.all([
        ConversationController.load(),
        Signal.Stickers.load(),
        Signal.Emojis.load(),
        textsecure.storage.protocol.hydrateCaches(),
      ]);
    } catch (error) {
      window.log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      initializeRedux();
      start();
    }
  });

  function initializeRedux() {
    // Here we set up a full redux store with initial state for our LeftPane Root
    const convoCollection = window.getConversations();
    const conversations = convoCollection.map(
      conversation => conversation.cachedProps
    );
    const initialState = {
      conversations: {
        conversationLookup: Signal.Util.makeLookup(conversations, 'id'),
        messagesByConversation: {},
        messagesLookup: {},
        selectedConversation: null,
        selectedMessage: null,
        selectedMessageCounter: 0,
        showArchived: false,
      },
      emojis: Signal.Emojis.getInitialState(),
      items: storage.getItemsState(),
      stickers: Signal.Stickers.getInitialState(),
      user: {
        attachmentsPath: window.baseAttachmentsPath,
        stickersPath: window.baseStickersPath,
        tempPath: window.baseTempPath,
        regionCode: window.storage.get('regionCode'),
        ourNumber: textsecure.storage.user.getNumber(),
        platform: window.platform,
        i18n: window.i18n,
        interactionMode: window.getInteractionMode(),
      },
    };

    const store = Signal.State.createStore(initialState);
    window.reduxStore = store;

    const actions = {};
    window.reduxActions = actions;

    // Binding these actions to our redux store and exposing them allows us to update
    //   redux when things change in the backbone world.
    actions.conversations = Signal.State.bindActionCreators(
      Signal.State.Ducks.conversations.actions,
      store.dispatch
    );
    actions.emojis = Signal.State.bindActionCreators(
      Signal.State.Ducks.emojis.actions,
      store.dispatch
    );
    actions.items = Signal.State.bindActionCreators(
      Signal.State.Ducks.items.actions,
      store.dispatch
    );
    actions.user = Signal.State.bindActionCreators(
      Signal.State.Ducks.user.actions,
      store.dispatch
    );
    actions.search = Signal.State.bindActionCreators(
      Signal.State.Ducks.search.actions,
      store.dispatch
    );
    actions.stickers = Signal.State.bindActionCreators(
      Signal.State.Ducks.stickers.actions,
      store.dispatch
    );

    const {
      conversationAdded,
      conversationChanged,
      conversationRemoved,
      removeAllConversations,
      messageExpired,
    } = actions.conversations;
    const { userChanged } = actions.user;

    convoCollection.on('remove', conversation => {
      const { id } = conversation || {};
      conversationRemoved(id);
    });
    convoCollection.on('add', conversation => {
      const { id, cachedProps } = conversation || {};
      conversationAdded(id, cachedProps);
    });
    convoCollection.on('change', conversation => {
      const { id, cachedProps } = conversation || {};
      conversationChanged(id, cachedProps);
    });
    convoCollection.on('reset', removeAllConversations);

    Whisper.events.on('messageExpired', messageExpired);
    Whisper.events.on('userChanged', userChanged);

    let shortcutGuideView = null;

    window.showKeyboardShortcuts = () => {
      if (!shortcutGuideView) {
        shortcutGuideView = new Whisper.ReactWrapperView({
          className: 'shortcut-guide-wrapper',
          JSX: Signal.State.Roots.createShortcutGuideModal(window.reduxStore, {
            close: () => {
              if (shortcutGuideView) {
                shortcutGuideView.remove();
                shortcutGuideView = null;
              }
            },
          }),
          onClose: () => {
            shortcutGuideView = null;
          },
        });
      }
    };

    function findConversation(conversationId, direction, unreadOnly) {
      const state = store.getState();
      const lists = Signal.State.Selectors.conversations.getLeftPaneLists(
        state
      );
      const toSearch = state.conversations.showArchived
        ? lists.archivedConversations
        : lists.conversations;

      const increment = direction === 'up' ? -1 : 1;
      let startIndex;

      if (conversationId) {
        const index = toSearch.findIndex(item => item.id === conversationId);
        if (index >= 0) {
          startIndex = index + increment;
        }
      } else {
        startIndex = direction === 'up' ? toSearch.length - 1 : 0;
      }

      for (
        let i = startIndex, max = toSearch.length;
        i >= 0 && i < max;
        i += increment
      ) {
        const target = toSearch[i];
        if (!unreadOnly) {
          return target.id;
        } else if (target.unreadCount > 0) {
          return target.id;
        }
      }

      return null;
    }

    document.addEventListener('keydown', event => {
      const { altKey, ctrlKey, key, metaKey, shiftKey } = event;

      const optionOrAlt = altKey;
      const ctrlOrCommand = metaKey || ctrlKey;

      const state = store.getState();
      const selectedId = state.conversations.selectedConversation;
      const conversation = ConversationController.get(selectedId);
      const isSearching = Signal.State.Selectors.search.isSearching(state);

      // NAVIGATION

      // Show keyboard shortcuts - handled by Electron-managed keyboard shortcuts
      // However, on linux Ctrl+/ selects all text, so we prevent that
      if (ctrlOrCommand && key === '/') {
        window.showKeyboardShortcuts();

        event.stopPropagation();
        event.preventDefault();

        return;
      }

      // Navigate by section
      if (ctrlOrCommand && !shiftKey && (key === 't' || key === 'T')) {
        window.enterKeyboardMode();
        const focusedElement = document.activeElement;

        const targets = [
          document.querySelector('.module-main-header .module-avatar-button'),
          document.querySelector('.module-left-pane__to-inbox-button'),
          document.querySelector('.module-main-header__search__input'),
          document.querySelector('.module-left-pane__list'),
          document.querySelector('.module-search-results'),
          document.querySelector(
            '.module-composition-area .public-DraftEditor-content'
          ),
        ];
        const focusedIndex = targets.findIndex(target => {
          if (!target || !focusedElement) {
            return false;
          }

          if (target === focusedElement) {
            return true;
          }

          if (target.contains(focusedElement)) {
            return true;
          }

          return false;
        });
        const lastIndex = targets.length - 1;

        let index;
        if (focusedIndex < 0 || focusedIndex >= lastIndex) {
          index = 0;
        } else {
          index = focusedIndex + 1;
        }

        while (!targets[index]) {
          index += 1;
          if (index > lastIndex) {
            index = 0;
          }
        }

        targets[index].focus();
      }

      // Cancel out of keyboard shortcut screen - has first precedence
      if (shortcutGuideView && key === 'Escape') {
        shortcutGuideView.remove();
        shortcutGuideView = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Escape is heavily overloaded - here we avoid clashes with other Escape handlers
      if (key === 'Escape') {
        // Check origin - if within a react component which handles escape, don't handle.
        //   Why? Because React's synthetic events can cause events to be handled twice.
        const target = document.activeElement;

        if (
          target &&
          target.attributes &&
          target.attributes.class &&
          target.attributes.class.value
        ) {
          const className = target.attributes.class.value;

          // These want to handle events internally

          // CaptionEditor text box
          if (className.includes('module-caption-editor__caption-input')) {
            return;
          }

          // MainHeader search box
          if (className.includes('module-main-header__search__input')) {
            return;
          }
        }

        // These add listeners to document, but we'll run first
        const confirmationModal = document.querySelector(
          '.module-confirmation-dialog__overlay'
        );
        if (confirmationModal) {
          return;
        }

        const emojiPicker = document.querySelector('.module-emoji-picker');
        if (emojiPicker) {
          return;
        }

        const lightBox = document.querySelector('.module-lightbox');
        if (lightBox) {
          return;
        }

        const stickerPicker = document.querySelector('.module-sticker-picker');
        if (stickerPicker) {
          return;
        }

        const stickerPreview = document.querySelector(
          '.module-sticker-manager__preview-modal__overlay'
        );
        if (stickerPreview) {
          return;
        }
      }

      // Close Backbone-based confirmation dialog
      if (Whisper.activeConfirmationView && key === 'Escape') {
        Whisper.activeConfirmationView.remove();
        Whisper.activeConfirmationView = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Send Escape to active conversation so it can close panels
      if (conversation && key === 'Escape') {
        conversation.trigger('escape-pressed');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Change currently selected conversation - up/down, to next/previous unread
      if (!isSearching && optionOrAlt && !shiftKey && key === 'ArrowUp') {
        const unreadOnly = false;
        const targetId = findConversation(
          conversation ? conversation.id : null,
          'up',
          unreadOnly
        );

        if (targetId) {
          window.Whisper.events.trigger('showConversation', targetId);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if (!isSearching && optionOrAlt && !shiftKey && key === 'ArrowDown') {
        const unreadOnly = false;
        const targetId = findConversation(
          conversation ? conversation.id : null,
          'down',
          unreadOnly
        );

        if (targetId) {
          window.Whisper.events.trigger('showConversation', targetId);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if (!isSearching && optionOrAlt && shiftKey && key === 'ArrowUp') {
        const unreadOnly = true;
        const targetId = findConversation(
          conversation ? conversation.id : null,
          'up',
          unreadOnly
        );

        if (targetId) {
          window.Whisper.events.trigger('showConversation', targetId);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if (!isSearching && optionOrAlt && shiftKey && key === 'ArrowDown') {
        const unreadOnly = true;
        const targetId = findConversation(
          conversation ? conversation.id : null,
          'down',
          unreadOnly
        );

        if (targetId) {
          window.Whisper.events.trigger('showConversation', targetId);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      // Preferences - handled by Electron-managed keyboard shortcuts

      // Open the top-right menu for current conversation
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'l' || key === 'L')
      ) {
        const button = document.querySelector(
          '.module-conversation-header__more-button'
        );
        if (!button) {
          return;
        }

        // Because the menu is shown at a location based on the initiating click, we need
        //   to fake up a mouse event to get the menu to show somewhere other than (0,0).
        const { x, y, width, height } = button.getBoundingClientRect();
        const mouseEvent = document.createEvent('MouseEvents');
        mouseEvent.initMouseEvent(
          'click',
          true, // bubbles
          false, // cancelable
          null, // view
          null, // detail
          0, // screenX,
          0, // screenY,
          x + width / 2,
          y + height / 2,
          false, // ctrlKey,
          false, // altKey,
          false, // shiftKey,
          false, // metaKey,
          false, // button,
          document.body
        );

        button.dispatchEvent(mouseEvent);

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Search
      if (ctrlOrCommand && !shiftKey && (key === 'f' || key === 'F')) {
        const { startSearch } = actions.search;
        startSearch();

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Search in conversation
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'f' || key === 'F')
      ) {
        const { searchInConversation } = actions.search;
        const name = conversation.isMe()
          ? window.i18n('noteToSelf')
          : conversation.getTitle();
        searchInConversation(conversation.id, name);

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Focus composer field
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 't' || key === 'T')
      ) {
        conversation.trigger('focus-composer');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Open all media
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'm' || key === 'M')
      ) {
        conversation.trigger('open-all-media');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Open emoji picker - handled by component

      // Open sticker picker - handled by component

      // Begin recording voice note
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'v' || key === 'V')
      ) {
        conversation.trigger('begin-recording');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Archive or unarchive conversation
      if (
        conversation &&
        !conversation.get('isArchived') &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'a' || key === 'A')
      ) {
        conversation.setArchived(true);
        conversation.trigger('unload', 'keyboard shortcut archive');
        Whisper.ToastView.show(
          Whisper.ConversationArchivedToast,
          document.body
        );

        // It's very likely that the act of archiving a conversation will set focus to
        //   'none,' or the top-level body element. This resets it to the left pane,
        //   whether in the normal conversation list or search results.
        if (document.activeElement === document.body) {
          const leftPaneEl = document.querySelector('.module-left-pane__list');
          if (leftPaneEl) {
            leftPaneEl.focus();
          }

          const searchResultsEl = document.querySelector(
            '.module-search-results'
          );
          if (searchResultsEl) {
            searchResultsEl.focus();
          }
        }

        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        conversation &&
        conversation.get('isArchived') &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'u' || key === 'U')
      ) {
        conversation.setArchived(false);
        Whisper.ToastView.show(
          Whisper.ConversationUnarchivedToast,
          document.body
        );

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Scroll to bottom of list - handled by component

      // Scroll to top of list - handled by component

      // Close conversation
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'c' || key === 'C')
      ) {
        conversation.trigger('unload', 'keyboard shortcut close');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // MESSAGES

      // Show message details
      if (
        conversation &&
        ctrlOrCommand &&
        !shiftKey &&
        (key === 'd' || key === 'D')
      ) {
        const { selectedMessage } = state.conversations;
        if (!selectedMessage) {
          return;
        }

        conversation.trigger('show-message-details', selectedMessage);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Toggle reply to message
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'r' || key === 'R')
      ) {
        const { selectedMessage } = state.conversations;

        conversation.trigger('toggle-reply', selectedMessage);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Save attachment
      if (
        conversation &&
        ctrlOrCommand &&
        !shiftKey &&
        (key === 's' || key === 'S')
      ) {
        const { selectedMessage } = state.conversations;

        if (selectedMessage) {
          conversation.trigger('save-attachment', selectedMessage);

          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'd' || key === 'D')
      ) {
        const { selectedMessage } = state.conversations;

        if (selectedMessage) {
          conversation.trigger('delete-message', selectedMessage);

          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      // COMPOSER

      // Create a newline in your message - handled by component

      // Expand composer - handled by component

      // Send in expanded composer - handled by component

      // Attach file
      if (
        conversation &&
        ctrlOrCommand &&
        !shiftKey &&
        (key === 'u' || key === 'U')
      ) {
        conversation.trigger('attach-file');

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Remove draft link preview
      if (
        conversation &&
        ctrlOrCommand &&
        !shiftKey &&
        (key === 'p' || key === 'P')
      ) {
        conversation.trigger('remove-link-review');

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Attach file
      if (
        conversation &&
        ctrlOrCommand &&
        shiftKey &&
        (key === 'p' || key === 'P')
      ) {
        conversation.trigger('remove-all-draft-attachments');

        event.preventDefault();
        event.stopPropagation();
        // Commented out because this is the last item
        // return;
      }
    });
  }

  Whisper.events.on('setupWithImport', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openImporter();
    }
  });

  Whisper.events.on('setupAsNewDevice', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openInstaller();
    }
  });

  Whisper.events.on('setupAsStandalone', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openStandalone();
    }
  });

  async function start() {
    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('Cleanup: starting...');
    const messagesForCleanup = await window.Signal.Data.getOutgoingWithoutExpiresAt(
      {
        MessageCollection: Whisper.MessageCollection,
      }
    );
    window.log.info(
      `Cleanup: Found ${messagesForCleanup.length} messages for cleanup`
    );
    await Promise.all(
      messagesForCleanup.map(async message => {
        const delivered = message.get('delivered');
        const sentAt = message.get('sent_at');
        const expirationStartTimestamp = message.get(
          'expirationStartTimestamp'
        );

        if (message.hasErrors()) {
          return;
        }

        if (delivered) {
          window.log.info(
            `Cleanup: Starting timer for delivered message ${sentAt}`
          );
          message.set(
            'expirationStartTimestamp',
            expirationStartTimestamp || sentAt
          );
          await message.setToExpire();
          return;
        }

        window.log.info(`Cleanup: Deleting unsent message ${sentAt}`);
        await window.Signal.Data.removeMessage(message.id, {
          Message: Whisper.Message,
        });
        const conversation = message.getConversation();
        if (conversation) {
          await conversation.updateLastMessage();
        }
      })
    );
    window.log.info('Cleanup: complete');

    window.log.info('listening for registration events');
    Whisper.events.on('registration_done', () => {
      window.log.info('handling registration event');

      // listeners
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
      window.Signal.RefreshSenderCertificate.initialize({
        events: Whisper.events,
        storage,
        navigator,
        logger: window.log,
      });

      connect(true);
    });

    cancelInitializationMessage();
    const appView = new Whisper.AppView({
      el: $('body'),
    });
    window.owsDesktopApp.appView = appView;

    Whisper.WallClockListener.init(Whisper.events);
    Whisper.ExpiringMessagesListener.init(Whisper.events);
    Whisper.TapToViewMessagesListener.init(Whisper.events);

    if (Whisper.Import.isIncomplete()) {
      window.log.info('Import was interrupted, showing import error screen');
      appView.openImporter();
    } else if (Whisper.Registration.everDone()) {
      // listeners
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
      window.Signal.RefreshSenderCertificate.initialize({
        events: Whisper.events,
        storage,
        navigator,
        logger: window.log,
      });

      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else if (window.isImportMode()) {
      appView.openImporter();
    } else {
      appView.openInstaller();
    }

    Whisper.events.on('showDebugLog', () => {
      appView.openDebugLog();
    });
    Whisper.events.on('unauthorized', () => {
      appView.inboxView.networkStatusView.update();
    });
    Whisper.events.on('reconnectTimer', () => {
      appView.inboxView.networkStatusView.setSocketReconnectInterval(60000);
    });
    Whisper.events.on('contactsync', () => {
      if (appView.installView) {
        appView.openInbox();
      }
    });

    window.registerForActive(() => Whisper.Notifications.clear());
    window.addEventListener('unload', () => Whisper.Notifications.fastClear());

    Whisper.events.on('showConversation', (id, messageId) => {
      if (appView) {
        appView.openConversation(id, messageId);
      }
    });

    Whisper.Notifications.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        appView.openConversation(id, messageId);
      } else {
        appView.openInbox({
          initialLoadComplete,
        });
      }
    });
  }

  window.getSyncRequest = () =>
    new textsecure.SyncRequest(textsecure.messaging, messageReceiver);

  let disconnectTimer = null;
  function onOffline() {
    window.log.info('offline');

    window.removeEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // We've received logs from Linux where we get an 'offline' event, then 30ms later
    //   we get an online event. This waits a bit after getting an 'offline' event
    //   before disconnecting the socket manually.
    disconnectTimer = setTimeout(disconnect, 1000);
  }

  function onOnline() {
    window.log.info('online');

    window.removeEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (disconnectTimer && isSocketOnline()) {
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

  function isSocketOnline() {
    const socketStatus = window.getSocketStatus();
    return (
      socketStatus === WebSocket.CONNECTING || socketStatus === WebSocket.OPEN
    );
  }

  function disconnect() {
    window.log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = null;

    if (messageReceiver) {
      messageReceiver.close();
    }
    window.Signal.AttachmentDownloads.stop();
  }

  let connectCount = 0;
  async function connect(firstRun) {
    window.log.info('connect');

    // Bootstrap our online/offline detection, only the first time we connect
    if (connectCount === 0 && navigator.onLine) {
      window.addEventListener('offline', onOffline);
    }
    if (connectCount === 0 && !navigator.onLine) {
      window.log.warn(
        'Starting up offline; will connect when we have network access'
      );
      window.addEventListener('online', onOnline);
      onEmpty(); // this ensures that the loading screen is dismissed
      return;
    }

    if (!Whisper.Registration.everDone()) {
      return;
    }
    if (Whisper.Import.isIncomplete()) {
      return;
    }

    if (messageReceiver) {
      await messageReceiver.stopProcessing();

      await window.waitForAllBatchers();
      messageReceiver.unregisterBatchers();

      messageReceiver = null;
    }

    const USERNAME = storage.get('number_id');
    const PASSWORD = storage.get('password');
    const mySignalingKey = storage.get('signaling_key');

    connectCount += 1;
    const options = {
      retryCached: connectCount === 1,
      serverTrustRoot: window.getServerTrustRoot(),
    };

    deliveryReceiptQueue.pause(); // avoid flood of delivery receipts until we catch up
    Whisper.Notifications.disable(); // avoid notification flood until empty

    // initialize the socket and start listening for messages
    messageReceiver = new textsecure.MessageReceiver(
      USERNAME,
      PASSWORD,
      mySignalingKey,
      options
    );

    function addQueuedEventListener(name, handler) {
      messageReceiver.addEventListener(name, (...args) =>
        eventHandlerQueue.add(async () => {
          try {
            await handler(...args);
          } finally {
            // message/sent: Message.handleDataMessage has its own queue and will trigger
            //   this event itself when complete.
            // error: Error processing (below) also has its own queue and self-trigger.
            if (name !== 'message' && name !== 'sent' && name !== 'error') {
              Whisper.events.trigger('incrementProgress');
            }
          }
        })
      );
    }

    addQueuedEventListener('message', onMessageReceived);
    addQueuedEventListener('delivery', onDeliveryReceipt);
    addQueuedEventListener('contact', onContactReceived);
    addQueuedEventListener('group', onGroupReceived);
    addQueuedEventListener('sent', onSentMessage);
    addQueuedEventListener('readSync', onReadSync);
    addQueuedEventListener('read', onReadReceipt);
    addQueuedEventListener('verified', onVerified);
    addQueuedEventListener('error', onError);
    addQueuedEventListener('empty', onEmpty);
    addQueuedEventListener('reconnect', onReconnect);
    addQueuedEventListener('configuration', onConfiguration);
    addQueuedEventListener('typing', onTyping);
    addQueuedEventListener('sticker-pack', onStickerPack);
    addQueuedEventListener('viewSync', onViewSync);

    window.Signal.AttachmentDownloads.start({
      getMessageReceiver: () => messageReceiver,
      logger: window.log,
    });

    window.textsecure.messaging = new textsecure.MessageSender(
      USERNAME,
      PASSWORD
    );

    if (connectCount === 1) {
      window.Signal.Stickers.downloadQueuedPacks();
    }

    // On startup after upgrading to a new version, request a contact sync
    //   (but only if we're not the primary device)
    if (
      !firstRun &&
      connectCount === 1 &&
      newVersion &&
      // eslint-disable-next-line eqeqeq
      textsecure.storage.user.getDeviceId() != '1'
    ) {
      window.getSyncRequest();

      try {
        const manager = window.getAccountManager();
        await Promise.all([
          manager.maybeUpdateDeviceName(),
          manager.maybeDeleteSignalingKey(),
        ]);
      } catch (e) {
        window.log.error(
          'Problem with account manager updates after starting new version: ',
          e && e.stack ? e.stack : e
        );
      }
    }

    const udSupportKey = 'hasRegisterSupportForUnauthenticatedDelivery';
    if (!storage.get(udSupportKey)) {
      const server = WebAPI.connect({ username: USERNAME, password: PASSWORD });
      try {
        await server.registerSupportForUnauthenticatedDelivery();
        storage.put(udSupportKey, true);
      } catch (error) {
        window.log.error(
          'Error: Unable to register for unauthenticated delivery support.',
          error && error.stack ? error.stack : error
        );
      }
    }

    const deviceId = textsecure.storage.user.getDeviceId();
    if (firstRun === true && deviceId !== '1') {
      const hasThemeSetting = Boolean(storage.get('theme-setting'));
      if (!hasThemeSetting && textsecure.storage.get('userAgent') === 'OWI') {
        storage.put('theme-setting', 'ios');
        onChangeTheme();
      }
      const syncRequest = new textsecure.SyncRequest(
        textsecure.messaging,
        messageReceiver
      );
      Whisper.events.trigger('contactsync:begin');
      syncRequest.addEventListener('success', () => {
        window.log.info('sync successful');
        storage.put('synced_at', Date.now());
        Whisper.events.trigger('contactsync');
      });
      syncRequest.addEventListener('timeout', () => {
        window.log.error('sync timed out');
        Whisper.events.trigger('contactsync');
      });

      const ourNumber = textsecure.storage.user.getNumber();
      const { wrap, sendOptions } = ConversationController.prepareForSend(
        ourNumber,
        { syncMessage: true }
      );

      const installedStickerPacks = window.Signal.Stickers.getInstalledStickerPacks();
      if (installedStickerPacks.length) {
        const operations = installedStickerPacks.map(pack => ({
          packId: pack.id,
          packKey: pack.key,
          installed: true,
        }));

        wrap(
          window.textsecure.messaging.sendStickerPackSync(
            operations,
            sendOptions
          )
        ).catch(error => {
          window.log.error(
            'Failed to send installed sticker packs via sync message',
            error && error.stack ? error.stack : error
          );
        });
      }

      if (Whisper.Import.isComplete()) {
        wrap(
          textsecure.messaging.sendRequestConfigurationSyncMessage(sendOptions)
        ).catch(error => {
          window.log.error(
            'Import complete, but failed to send sync message',
            error && error.stack ? error.stack : error
          );
        });
      }
    }

    storage.onready(async () => {
      idleDetector.start();
    });
  }

  function onChangeTheme() {
    const view = window.owsDesktopApp.appView;
    if (view) {
      view.applyTheme();
    }
  }
  async function onEmpty() {
    await Promise.all([
      window.waitForAllBatchers(),
      window.waitForAllWaitBatchers(),
    ]);
    window.log.info('onEmpty: All outstanding database requests complete');
    initialLoadComplete = true;

    window.readyForUpdates();

    let interval = setInterval(() => {
      const view = window.owsDesktopApp.appView;
      if (view) {
        clearInterval(interval);
        interval = null;
        view.onEmpty();
      }
    }, 500);

    deliveryReceiptQueue.start();
    Whisper.Notifications.enable();
  }
  function onReconnect() {
    // We disable notifications on first connect, but the same applies to reconnect. In
    //   scenarios where we're coming back from sleep, we can get offline/online events
    //   very fast, and it looks like a network blip. But we need to suppress
    //   notifications in these scenarios too. So we listen for 'reconnect' events.
    deliveryReceiptQueue.pause();
    Whisper.Notifications.disable();
  }

  let initialStartupCount = 0;
  Whisper.events.on('incrementProgress', incrementProgress);
  function incrementProgress() {
    initialStartupCount += 1;

    // Only update progress every 10 items
    if (initialStartupCount % 10 !== 0) {
      return;
    }

    window.log.info(
      `incrementProgress: Message count is ${initialStartupCount}`
    );

    const view = window.owsDesktopApp.appView;
    if (view) {
      view.onProgress(initialStartupCount);
    }
  }

  function onConfiguration(ev) {
    ev.confirm();

    const { configuration } = ev;
    const {
      readReceipts,
      typingIndicators,
      unidentifiedDeliveryIndicators,
      linkPreviews,
    } = configuration;

    storage.put('read-receipt-setting', readReceipts);

    if (
      unidentifiedDeliveryIndicators === true ||
      unidentifiedDeliveryIndicators === false
    ) {
      storage.put(
        'unidentifiedDeliveryIndicators',
        unidentifiedDeliveryIndicators
      );
    }

    if (typingIndicators === true || typingIndicators === false) {
      storage.put('typingIndicators', typingIndicators);
    }

    if (linkPreviews === true || linkPreviews === false) {
      storage.put('linkPreviews', linkPreviews);
    }
  }

  function onTyping(ev) {
    // Note: this type of message is automatically removed from cache in MessageReceiver

    const { typing, sender, senderDevice } = ev;
    const { groupId, started } = typing || {};

    // We don't do anything with incoming typing messages if the setting is disabled
    if (!storage.get('typingIndicators')) {
      return;
    }

    const conversation = ConversationController.get(groupId || sender);
    const ourNumber = textsecure.storage.user.getNumber();

    if (conversation) {
      // We drop typing notifications in groups we're not a part of
      if (!conversation.isPrivate() && !conversation.hasMember(ourNumber)) {
        window.log.warn(
          `Received typing indicator for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
        );
        return;
      }

      conversation.notifyTyping({
        isTyping: started,
        sender,
        senderDevice,
      });
    }
  }

  async function onStickerPack(ev) {
    ev.confirm();

    const packs = ev.stickerPacks || [];

    packs.forEach(pack => {
      const { id, key, isInstall, isRemove } = pack || {};

      if (!id || !key || (!isInstall && !isRemove)) {
        window.log.warn(
          'Received malformed sticker pack operation sync message'
        );
        return;
      }

      const status = window.Signal.Stickers.getStickerPackStatus(id);

      if (status === 'installed' && isRemove) {
        window.reduxActions.stickers.uninstallStickerPack(id, key, {
          fromSync: true,
        });
      } else if (isInstall) {
        if (status === 'downloaded') {
          window.reduxActions.stickers.installStickerPack(id, key, {
            fromSync: true,
          });
        } else {
          window.Signal.Stickers.downloadStickerPack(id, key, {
            finalStatus: 'installed',
            fromSync: true,
          });
        }
      }
    });
  }

  async function onContactReceived(ev) {
    const details = ev.contactDetails;

    const id = details.number;

    if (id === textsecure.storage.user.getNumber()) {
      // special case for syncing details about ourselves
      if (details.profileKey) {
        window.log.info('Got sync message with our own profile key');
        storage.put('profileKey', details.profileKey);
      }
    }

    const c = new Whisper.Conversation({
      id,
    });
    const validationError = c.validateNumber();
    if (validationError) {
      window.log.error(
        'Invalid contact received:',
        Errors.toLogFormat(validationError)
      );
      return;
    }

    try {
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        'private'
      );
      let activeAt = conversation.get('active_at');

      // The idea is to make any new contact show up in the left pane. If
      //   activeAt is null, then this contact has been purposefully hidden.
      if (activeAt !== null) {
        activeAt = activeAt || Date.now();
      }

      if (details.profileKey) {
        const profileKey = window.Signal.Crypto.arrayBufferToBase64(
          details.profileKey
        );
        conversation.setProfileKey(profileKey);
      } else {
        conversation.dropProfileKey();
      }

      if (typeof details.blocked !== 'undefined') {
        if (details.blocked) {
          storage.addBlockedNumber(id);
        } else {
          storage.removeBlockedNumber(id);
        }
      }

      conversation.set({
        name: details.name,
        color: details.color,
        active_at: activeAt,
      });

      // Update the conversation avatar only if new avatar exists and hash differs
      const { avatar } = details;
      if (avatar && avatar.data) {
        const newAttributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
          conversation.attributes,
          avatar.data,
          {
            writeNewAttachmentData,
            deleteAttachmentData,
            doesAttachmentExist,
          }
        );
        conversation.set(newAttributes);
      }

      window.Signal.Data.updateConversation(id, conversation.attributes);

      const { expireTimer } = details;
      const isValidExpireTimer = typeof expireTimer === 'number';
      if (isValidExpireTimer) {
        const source = textsecure.storage.user.getNumber();
        const receivedAt = Date.now();

        await conversation.updateExpirationTimer(
          expireTimer,
          source,
          receivedAt,
          { fromSync: true }
        );
      }

      if (details.verified) {
        const { verified } = details;
        const verifiedEvent = new Event('verified');
        verifiedEvent.verified = {
          state: verified.state,
          destination: verified.destination,
          identityKey: verified.identityKey.toArrayBuffer(),
        };
        verifiedEvent.viaContactSync = true;
        await onVerified(verifiedEvent);
      }
    } catch (error) {
      window.log.error('onContactReceived error:', Errors.toLogFormat(error));
    }
  }

  async function onGroupReceived(ev) {
    const details = ev.groupDetails;
    const { id } = details;

    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );

    const updates = {
      name: details.name,
      members: details.members,
      color: details.color,
      type: 'group',
    };

    if (details.active) {
      const activeAt = conversation.get('active_at');

      // The idea is to make any new group show up in the left pane. If
      //   activeAt is null, then this group has been purposefully hidden.
      if (activeAt !== null) {
        updates.active_at = activeAt || Date.now();
      }
      updates.left = false;
    } else {
      updates.left = true;
    }

    if (details.blocked) {
      storage.addBlockedGroup(id);
    } else {
      storage.removeBlockedGroup(id);
    }

    conversation.set(updates);

    // Update the conversation avatar only if new avatar exists and hash differs
    const { avatar } = details;
    if (avatar && avatar.data) {
      const newAttributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
        conversation.attributes,
        avatar.data,
        {
          writeNewAttachmentData,
          deleteAttachmentData,
          doesAttachmentExist,
        }
      );
      conversation.set(newAttributes);
    }

    window.Signal.Data.updateConversation(id, conversation.attributes);

    const { expireTimer } = details;
    const isValidExpireTimer = typeof expireTimer === 'number';
    if (!isValidExpireTimer) {
      return;
    }

    const source = textsecure.storage.user.getNumber();
    const receivedAt = Date.now();
    await conversation.updateExpirationTimer(expireTimer, source, receivedAt, {
      fromSync: true,
    });
  }

  // Descriptors
  const getGroupDescriptor = group => ({
    type: Message.GROUP,
    id: group.id,
  });

  // Matches event data from `libtextsecure` `MessageReceiver::handleSentMessage`:
  const getDescriptorForSent = ({ message, destination }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: destination };

  // Matches event data from `libtextsecure` `MessageReceiver::handleDataMessage`:
  const getDescriptorForReceived = ({ message, source }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: source };

  // Received:
  async function handleMessageReceivedProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    const profileKey = data.message.profileKey.toString('base64');
    const sender = await ConversationController.getOrCreateAndWait(
      messageDescriptor.id,
      'private'
    );

    // Will do the save for us
    await sender.setProfileKey(profileKey);

    return confirm();
  }

  async function onMessageReceived(event) {
    const { data, confirm } = event;

    const messageDescriptor = getDescriptorForReceived(data);

    const { PROFILE_KEY_UPDATE } = textsecure.protobuf.DataMessage.Flags;
    // eslint-disable-next-line no-bitwise
    const isProfileUpdate = Boolean(data.message.flags & PROFILE_KEY_UPDATE);
    if (isProfileUpdate) {
      await handleMessageReceivedProfileUpdate({
        data,
        confirm,
        messageDescriptor,
      });
      return;
    }

    const isDuplicate = await isMessageDuplicate({
      source: data.source,
      sourceDevice: data.sourceDevice,
      sent_at: data.timestamp,
    });
    if (isDuplicate) {
      window.log.warn(
        'Received duplicate message',
        `${data.source}.${data.sourceDevice} ${data.timestamp}`
      );
      confirm();
      return;
    }

    // We do this after the duplicate check because it might send a delivery receipt
    const message = await initIncomingMessage(data);

    const ourNumber = textsecure.storage.user.getNumber();
    const isGroupUpdate =
      data.message.group &&
      data.message.group.type !== textsecure.protobuf.GroupContext.Type.DELIVER;
    const conversation = ConversationController.get(messageDescriptor.id);

    // We drop messages for groups we already know about, which we're not a part of,
    //   except for group updates
    if (
      conversation &&
      !conversation.isPrivate() &&
      !conversation.hasMember(ourNumber) &&
      !isGroupUpdate
    ) {
      window.log.warn(
        `Received message destined for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
      );
      confirm();
      return;
    }

    await ConversationController.getOrCreateAndWait(
      messageDescriptor.id,
      messageDescriptor.type
    );

    // Don't wait for handleDataMessage, as it has its own per-conversation queueing
    message.handleDataMessage(data.message, event.confirm, {
      initialLoadComplete,
    });
  }

  // Sent:
  async function handleMessageSentProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    // First set profileSharing = true for the conversation we sent to
    const { id, type } = messageDescriptor;
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );

    conversation.set({ profileSharing: true });
    window.Signal.Data.updateConversation(id, conversation.attributes);

    // Then we update our own profileKey if it's different from what we have
    const ourNumber = textsecure.storage.user.getNumber();
    const profileKey = data.message.profileKey.toString('base64');
    const me = await ConversationController.getOrCreate(ourNumber, 'private');

    // Will do the save for us if needed
    await me.setProfileKey(profileKey);

    return confirm();
  }

  function createSentMessage(data) {
    const now = Date.now();
    let sentTo = [];

    if (data.unidentifiedStatus && data.unidentifiedStatus.length) {
      sentTo = data.unidentifiedStatus.map(item => item.destination);
      const unidentified = _.filter(data.unidentifiedStatus, item =>
        Boolean(item.unidentified)
      );
      // eslint-disable-next-line no-param-reassign
      data.unidentifiedDeliveries = unidentified.map(item => item.destination);
    }

    return new Whisper.Message({
      source: textsecure.storage.user.getNumber(),
      sourceDevice: data.device,
      sent_at: data.timestamp,
      sent_to: sentTo,
      received_at: now,
      conversationId: data.destination,
      type: 'outgoing',
      sent: true,
      unidentifiedDeliveries: data.unidentifiedDeliveries || [],
      expirationStartTimestamp: Math.min(
        data.expirationStartTimestamp || data.timestamp || Date.now(),
        Date.now()
      ),
    });
  }

  async function onSentMessage(event) {
    const { data, confirm } = event;

    const messageDescriptor = getDescriptorForSent(data);

    const { PROFILE_KEY_UPDATE } = textsecure.protobuf.DataMessage.Flags;
    // eslint-disable-next-line no-bitwise
    const isProfileUpdate = Boolean(data.message.flags & PROFILE_KEY_UPDATE);
    if (isProfileUpdate) {
      await handleMessageSentProfileUpdate({
        data,
        confirm,
        messageDescriptor,
      });
      return;
    }

    const message = await createSentMessage(data);
    const existing = await getExistingMessage(message.attributes);
    const isUpdate = Boolean(data.isRecipientUpdate);

    if (isUpdate && existing) {
      event.confirm();

      let sentTo = [];
      let unidentifiedDeliveries = [];
      if (Array.isArray(data.unidentifiedStatus)) {
        sentTo = data.unidentifiedStatus.map(item => item.destination);

        const unidentified = _.filter(data.unidentifiedStatus, item =>
          Boolean(item.unidentified)
        );
        unidentifiedDeliveries = unidentified.map(item => item.destination);
      }

      existing.set({
        sent_to: _.union(existing.get('sent_to'), sentTo),
        unidentifiedDeliveries: _.union(
          existing.get('unidentifiedDeliveries'),
          unidentifiedDeliveries
        ),
      });
      await window.Signal.Data.saveMessage(existing.attributes, {
        Message: Whisper.Message,
      });
    } else if (isUpdate) {
      window.log.warn(
        `onSentMessage: Received update transcript, but no existing entry for message ${message.idForLogging()}. Dropping.`
      );
      event.confirm();
    } else if (existing) {
      window.log.warn(
        `onSentMessage: Received duplicate transcript for message ${message.idForLogging()}, but it was not an update transcript. Dropping.`
      );
      event.confirm();
    } else {
      await ConversationController.getOrCreateAndWait(
        messageDescriptor.id,
        messageDescriptor.type
      );

      // Don't wait for handleDataMessage, as it has its own per-conversation queueing
      message.handleDataMessage(data.message, event.confirm, {
        initialLoadComplete,
      });
    }
  }

  async function getExistingMessage(data) {
    try {
      const result = await window.Signal.Data.getMessageBySender(data, {
        Message: Whisper.Message,
      });

      if (result) {
        return MessageController.register(result.id, result);
      }

      return null;
    } catch (error) {
      window.log.error('getExistingMessage error:', Errors.toLogFormat(error));
      return false;
    }
  }

  async function isMessageDuplicate(data) {
    const result = await getExistingMessage(data);
    return Boolean(result);
  }

  async function initIncomingMessage(data, options = {}) {
    const { isError } = options;

    const message = new Whisper.Message({
      source: data.source,
      sourceDevice: data.sourceDevice,
      sent_at: data.timestamp,
      received_at: data.receivedAt || Date.now(),
      conversationId: data.source,
      unidentifiedDeliveryReceived: data.unidentifiedDeliveryReceived,
      type: 'incoming',
      unread: 1,
    });

    // If we don't return early here, we can get into infinite error loops. So, no
    //   delivery receipts for sealed sender errors.
    if (isError || !data.unidentifiedDeliveryReceived) {
      return message;
    }

    // Note: We both queue and batch because we want to wait until we are done processing
    //   incoming messages to start sending outgoing delivery receipts. The queue can be
    //   paused easily.
    deliveryReceiptQueue.add(() => {
      deliveryReceiptBatcher.add({
        source: data.source,
        timestamp: data.timestamp,
      });
    });

    return message;
  }

  async function unlinkAndDisconnect() {
    Whisper.events.trigger('unauthorized');

    if (messageReceiver) {
      await messageReceiver.stopProcessing();

      await window.waitForAllBatchers();
      messageReceiver.unregisterBatchers();

      messageReceiver = null;
    }

    onEmpty();

    window.log.warn(
      'Client is no longer authorized; deleting local configuration'
    );
    Whisper.Registration.remove();

    const NUMBER_ID_KEY = 'number_id';
    const VERSION_KEY = 'version';
    const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
    const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

    const previousNumberId = textsecure.storage.get(NUMBER_ID_KEY);
    const lastProcessedIndex = textsecure.storage.get(LAST_PROCESSED_INDEX_KEY);
    const isMigrationComplete = textsecure.storage.get(
      IS_MIGRATION_COMPLETE_KEY
    );

    try {
      await textsecure.storage.protocol.removeAllConfiguration();

      // These two bits of data are important to ensure that the app loads up
      //   the conversation list, instead of showing just the QR code screen.
      Whisper.Registration.markEverDone();
      textsecure.storage.put(NUMBER_ID_KEY, previousNumberId);

      // These two are important to ensure we don't rip through every message
      //   in the database attempting to upgrade it after starting up again.
      textsecure.storage.put(
        IS_MIGRATION_COMPLETE_KEY,
        isMigrationComplete || false
      );
      textsecure.storage.put(
        LAST_PROCESSED_INDEX_KEY,
        lastProcessedIndex || null
      );
      textsecure.storage.put(VERSION_KEY, window.getVersion());

      window.log.info('Successfully cleared local configuration');
    } catch (eraseError) {
      window.log.error(
        'Something went wrong clearing local configuration',
        eraseError && eraseError.stack ? eraseError.stack : eraseError
      );
    }
  }

  async function onError(ev) {
    const { error } = ev;
    window.log.error('background onError:', Errors.toLogFormat(error));

    if (
      error &&
      error.name === 'HTTPError' &&
      (error.code === 401 || error.code === 403)
    ) {
      await unlinkAndDisconnect();
      return;
    }

    if (error && error.name === 'HTTPError' && error.code === -1) {
      // Failed to connect to server
      if (navigator.onLine) {
        window.log.info('retrying in 1 minute');
        setTimeout(connect, 60000);

        Whisper.events.trigger('reconnectTimer');
      }
      return;
    }

    if (ev.proto) {
      if (error && error.name === 'MessageCounterError') {
        if (ev.confirm) {
          ev.confirm();
        }
        // Ignore this message. It is likely a duplicate delivery
        // because the server lost our ack the first time.
        return;
      }
      const envelope = ev.proto;
      const message = await initIncomingMessage(envelope, { isError: true });
      const isDuplicate = await isMessageDuplicate(message.attributes);
      if (isDuplicate) {
        ev.confirm();
        window.log.warn(
          `Got duplicate error for message ${message.idForLogging()}`
        );
        return;
      }

      const conversationId = message.get('conversationId');
      const conversation = await ConversationController.getOrCreateAndWait(
        conversationId,
        'private'
      );

      // This matches the queueing behavior used in Message.handleDataMessage
      conversation.queueJob(async () => {
        const model = new Whisper.Message({
          ...message.attributes,
          id: window.getGuid(),
        });
        await model.saveErrors(error || new Error('Error was null'), {
          skipSave: true,
        });

        MessageController.register(model.id, model);
        await window.Signal.Data.saveMessage(model.attributes, {
          Message: Whisper.Message,
          forceSave: true,
        });

        conversation.set({
          active_at: Date.now(),
          unreadCount: conversation.get('unreadCount') + 1,
        });

        const conversationTimestamp = conversation.get('timestamp');
        const messageTimestamp = model.get('timestamp');
        if (
          !conversationTimestamp ||
          messageTimestamp > conversationTimestamp
        ) {
          conversation.set({ timestamp: model.get('sent_at') });
        }

        conversation.trigger('newmessage', model);
        conversation.notify(model);

        Whisper.events.trigger('incrementProgress');

        if (ev.confirm) {
          ev.confirm();
        }

        window.Signal.Data.updateConversation(
          conversationId,
          conversation.attributes
        );
      });
    }

    throw error;
  }

  async function onViewSync(ev) {
    ev.confirm();

    const { source, timestamp } = ev;
    window.log.info(`view sync ${source} ${timestamp}`);

    const sync = Whisper.ViewSyncs.add({
      source,
      timestamp,
    });

    Whisper.ViewSyncs.onSync(sync);
  }

  function onReadReceipt(ev) {
    const readAt = ev.timestamp;
    const { timestamp } = ev.read;
    const { reader } = ev.read;
    window.log.info('read receipt', reader, timestamp);

    ev.confirm();

    if (!storage.get('read-receipt-setting')) {
      return;
    }

    const receipt = Whisper.ReadReceipts.add({
      reader,
      timestamp,
      read_at: readAt,
    });

    // Note: We do not wait for completion here
    Whisper.ReadReceipts.onReceipt(receipt);
  }

  function onReadSync(ev) {
    const readAt = ev.timestamp;
    const { timestamp } = ev.read;
    const { sender } = ev.read;
    window.log.info('read sync', sender, timestamp);

    const receipt = Whisper.ReadSyncs.add({
      sender,
      timestamp,
      read_at: readAt,
    });

    receipt.on('remove', ev.confirm);

    // Note: Here we wait, because we want read states to be in the database
    //   before we move on.
    return Whisper.ReadSyncs.onReceipt(receipt);
  }

  async function onVerified(ev) {
    const number = ev.verified.destination;
    const key = ev.verified.identityKey;
    let state;

    if (ev.confirm) {
      ev.confirm();
    }

    const c = new Whisper.Conversation({
      id: number,
    });
    const error = c.validateNumber();
    if (error) {
      window.log.error(
        'Invalid verified sync received:',
        Errors.toLogFormat(error)
      );
      return;
    }

    switch (ev.verified.state) {
      case textsecure.protobuf.Verified.State.DEFAULT:
        state = 'DEFAULT';
        break;
      case textsecure.protobuf.Verified.State.VERIFIED:
        state = 'VERIFIED';
        break;
      case textsecure.protobuf.Verified.State.UNVERIFIED:
        state = 'UNVERIFIED';
        break;
      default:
        window.log.error(`Got unexpected verified state: ${ev.verified.state}`);
    }

    window.log.info(
      'got verified sync for',
      number,
      state,
      ev.viaContactSync ? 'via contact sync' : ''
    );

    const contact = await ConversationController.getOrCreateAndWait(
      number,
      'private'
    );
    const options = {
      viaSyncMessage: true,
      viaContactSync: ev.viaContactSync,
      key,
    };

    if (state === 'VERIFIED') {
      await contact.setVerified(options);
    } else if (state === 'DEFAULT') {
      await contact.setVerifiedDefault(options);
    } else {
      await contact.setUnverified(options);
    }
  }

  function onDeliveryReceipt(ev) {
    const { deliveryReceipt } = ev;
    window.log.info(
      'delivery receipt from',
      `${deliveryReceipt.source}.${deliveryReceipt.sourceDevice}`,
      deliveryReceipt.timestamp
    );

    ev.confirm();

    const receipt = Whisper.DeliveryReceipts.add({
      timestamp: deliveryReceipt.timestamp,
      source: deliveryReceipt.source,
    });

    // Note: We don't wait for completion here
    Whisper.DeliveryReceipts.onReceipt(receipt);
  }
})();
