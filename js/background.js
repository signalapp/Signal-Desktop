/* global
  $,
  _,
  Backbone,
  Signal,
  storage,
  textsecure,
  Whisper,
  libsession,
  libsignal,
  BlockedNumberController,
  libsession,
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
    'crown.svg',
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

  const { Views } = window.Signal;

  // Implicitly used in `indexeddb-backbonejs-adapter`:
  // https://github.com/signalapp/Signal-Desktop/blob/4033a9f8137e62ed286170ed5d4941982b1d3a64/components/indexeddb-backbonejs-adapter/backbone-indexeddb.js#L569
  window.onInvalidStateError = error =>
    window.log.error(error && error.stack ? error.stack : error);

  window.log.info('background page reloaded');
  window.log.info('environment:', window.getEnvironment());
  const restartReason = localStorage.getItem('restart-reason');
  window.log.info('restartReason:', restartReason);

  if (restartReason === 'unlink') {
    setTimeout(() => {
      localStorage.removeItem('restart-reason');

      window.libsession.Utils.ToastUtils.pushForceUnlinked();
    }, 2000);
  }

  let initialLoadComplete = false;
  let newVersion = false;

  window.document.title = window.getTitle();

  let messageReceiver;
  Whisper.events = _.clone(Backbone.Events);
  Whisper.events.isListenedTo = eventName =>
    Whisper.events._events ? !!Whisper.events._events[eventName] : false;
  const cancelInitializationMessage = Views.Initialization.setMessage();

  window.log.info('Storage fetch');
  storage.fetch();

  let specialConvInited = false;
  const initSpecialConversations = async () => {
    if (specialConvInited) {
      return;
    }
    const publicConversations = await window.Signal.Data.getAllOpenGroupV1Conversations();
    publicConversations.forEach(conversation => {
      // weird but create the object and does everything we need
      conversation.getPublicSendData();
    });
    specialConvInited = true;
  };

  const initAPIs = () => {
    if (window.initialisedAPI) {
      return;
    }
    const ourKey = libsession.Utils.UserUtils.getOurPubKeyStrFromCache();
    // singleton to relay events to libtextsecure/message_receiver
    window.lokiPublicChatAPI = new window.LokiPublicChatAPI(ourKey);

    // singleton to interface the File server
    // If already exists we registered as a secondary device
    if (!window.lokiFileServerAPI) {
      window.lokiFileServerAPIFactory = new window.LokiFileServerAPI(ourKey);
      window.lokiFileServerAPI = window.lokiFileServerAPIFactory.establishHomeConnection(
        window.getDefaultFileServer()
      );
    }

    window.initialisedAPI = true;
  };

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
        window.setAutoHideMenuBar(value);
        window.setMenuBarVisibility(!value);
      },

      getSpellCheck: () => storage.get('spell-check', true),
      setSpellCheck: value => {
        storage.put('spell-check', value);
      },

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),

      shutdown: async () => {
        // Stop background processing
        window.libsession.Utils.AttachmentDownloads.stop();

        // Stop processing incoming messages
        if (messageReceiver) {
          await messageReceiver.stopProcessing();
          messageReceiver = null;
        }

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

    Views.Initialization.setMessage(window.i18n('optimizingApplication'));

    Views.Initialization.setMessage(window.i18n('loading'));

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

  Whisper.events.on('setupWithImport', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openImporter();
    }
  });

  Whisper.events.on('deleteLocalPublicMessages', async ({ messageServerIds, conversationId }) => {
    if (!Array.isArray(messageServerIds)) {
      return;
    }
    const messageIds = await window.Signal.Data.getMessageIdsFromServerIds(
      messageServerIds,
      conversationId
    );
    if (messageIds.length === 0) {
      return;
    }

    const conversation = window.getConversationController().get(conversationId);
    messageIds.forEach(id => {
      if (conversation) {
        conversation.removeMessage(id);
      }
      window.Signal.Data.removeMessage(id);
    });
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
        const delivered = message.get('delivered');
        const sentAt = message.get('sent_at');
        const expirationStartTimestamp = message.get('expirationStartTimestamp');

        if (message.hasErrors()) {
          return;
        }

        if (delivered) {
          window.log.info(`Cleanup: Starting timer for delivered message ${sentAt}`);
          message.set('expirationStartTimestamp', expirationStartTimestamp || sentAt);
          await message.setToExpire();
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

    cancelInitializationMessage();
    const appView = new Whisper.AppView({
      el: $('body'),
    });

    Whisper.WallClockListener.init(Whisper.events);
    Whisper.ExpiringMessagesListener.init(Whisper.events);

    if (Whisper.Import.isIncomplete()) {
      window.log.info('Import was interrupted, showing import error screen');
      appView.openImporter();
    } else if (
      Whisper.Registration.isDone() &&
      !window.textsecure.storage.user.isSignInByLinking()
    ) {
      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else if (window.isImportMode()) {
      appView.openImporter();
    } else {
      appView.openStandalone();
    }

    Whisper.events.on('showDebugLog', () => {
      appView.openDebugLog();
    });

    window.addEventListener('focus', () => Whisper.Notifications.clear());
    window.addEventListener('unload', () => Whisper.Notifications.fastClear());

    window.confirmationDialog = params => {
      const confirmDialog = new Whisper.SessionConfirmView({
        el: $('body'),
        title: params.title,
        message: params.message,
        messageSub: params.messageSub || undefined,
        resolve: params.resolve || undefined,
        reject: params.reject || undefined,
        okText: params.okText || undefined,
        okTheme: params.okTheme || undefined,
        closeTheme: params.closeTheme || undefined,
        cancelText: params.cancelText || undefined,
        hideCancel: params.hideCancel || false,
        sessionIcon: params.sessionIcon || undefined,
        iconSize: params.iconSize || undefined,
      });

      confirmDialog.render();
    };

    window.showResetSessionIdDialog = () => {
      appView.showResetSessionIdDialog();
    };

    window.showEditProfileDialog = async () => {
      const ourNumber = window.storage.get('primaryDevicePubKey');
      const conversation = await window
        .getConversationController()
        .getOrCreateAndWait(ourNumber, 'private');

      const readFile = attachment =>
        new Promise((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.onload = e => {
            const data = e.target.result;
            resolve({
              ...attachment,
              data,
              size: data.byteLength,
            });
          };
          fileReader.onerror = reject;
          fileReader.onabort = reject;
          fileReader.readAsArrayBuffer(attachment.file);
        });

      const avatarPath = conversation.getAvatarPath();
      const profile = conversation.getLokiProfile();
      const displayName = profile && profile.displayName;

      if (appView) {
        appView.showEditProfileDialog({
          profileName: displayName,
          pubkey: ourNumber,
          avatarPath,
          onOk: async (newName, avatar) => {
            let newAvatarPath = '';
            let url = null;
            let profileKey = null;
            if (avatar) {
              const data = await readFile({ file: avatar });
              // Ensure that this file is either small enough or is resized to meet our
              //   requirements for attachments
              try {
                const withBlob = await window.Signal.Util.AttachmentUtil.autoScale(
                  {
                    contentType: avatar.type,
                    file: new Blob([data.data], {
                      type: avatar.contentType,
                    }),
                  },
                  {
                    maxSide: 640,
                    maxSize: 1000 * 1024,
                  }
                );
                const dataResized = await window.Signal.Types.Attachment.arrayBufferFromFile(
                  withBlob.file
                );

                // For simplicity we use the same attachment pointer that would send to
                // others, which means we need to wait for the database response.
                // To avoid the wait, we create a temporary url for the local image
                // and use it until we the the response from the server
                const tempUrl = window.URL.createObjectURL(avatar);
                conversation.setLokiProfile({ displayName: newName });
                conversation.set('avatar', tempUrl);

                // Encrypt with a new key every time
                profileKey = libsignal.crypto.getRandomBytes(32);
                const encryptedData = await textsecure.crypto.encryptProfile(
                  dataResized,
                  profileKey
                );

                const avatarPointer = await libsession.Utils.AttachmentUtils.uploadAvatarV1({
                  ...dataResized,
                  data: encryptedData,
                  size: encryptedData.byteLength,
                });

                ({ url } = avatarPointer);

                storage.put('profileKey', profileKey);

                conversation.set('avatarPointer', url);

                const upgraded = await Signal.Migrations.processNewAttachment({
                  isRaw: true,
                  data: data.data,
                  url,
                });
                newAvatarPath = upgraded.path;
                // Replace our temporary image with the attachment pointer from the server:
                conversation.set('avatar', null);
                conversation.setLokiProfile({
                  displayName: newName,
                  avatar: newAvatarPath,
                });
                await conversation.commit();
                window.libsession.Utils.UserUtils.setLastProfileUpdateTimestamp(Date.now());
                await window.libsession.Utils.SyncUtils.forceSyncConfigurationNowIfNeeded(true);
              } catch (error) {
                window.log.error(
                  'showEditProfileDialog Error ensuring that image is properly sized:',
                  error && error.stack ? error.stack : error
                );
              }
            } else {
              // do not update the avatar if it did not change
              conversation.setLokiProfile({
                displayName: newName,
              });
              // might be good to not trigger a sync if the name did not change
              await conversation.commit();
              window.libsession.Utils.UserUtils.setLastProfileUpdateTimestamp(Date.now());
              await window.libsession.Utils.SyncUtils.forceSyncConfigurationNowIfNeeded(true);
            }

            // inform all your registered public servers
            // could put load on all the servers
            // if they just keep changing their names without sending messages
            // so we could disable this here
            // or least it enable for the quickest response
            window.lokiPublicChatAPI.setProfileName(newName);

            if (avatar) {
              window
                .getConversationController()
                .getConversations()
                .filter(convo => convo.isPublic())
                .forEach(convo => convo.trigger('ourAvatarChanged', { url, profileKey }));
            }
          },
        });
      }
    };

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

    // Get memberlist. This function is not accurate >>
    // window.getMemberList = window.lokiPublicChatAPI.getListOfMembers();
    window.setTheme = newTheme => {
      $(document.body)
        .removeClass('dark-theme')
        .removeClass('light-theme')
        .addClass(`${newTheme}-theme`);
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
      window.libsession.Utils.ToastUtils.pushSpellCheckDirty();
    };

    window.toggleLinkPreview = () => {
      const newValue = !window.getSettingValue('link-preview-setting');
      window.setSettingValue('link-preview-setting', newValue);
    };

    window.toggleMediaPermissions = () => {
      const value = window.getMediaPermissions();
      window.setMediaPermissions(!value);
    };

    Whisper.events.on('updateGroupName', async groupConvo => {
      if (appView) {
        appView.showUpdateGroupNameDialog(groupConvo);
      }
    });
    Whisper.events.on('updateGroupMembers', async groupConvo => {
      if (appView) {
        appView.showUpdateGroupMembersDialog(groupConvo);
      }
    });

    Whisper.events.on('inviteContacts', async groupConvo => {
      if (appView) {
        appView.showInviteContactsDialog(groupConvo);
      }
    });

    Whisper.events.on('addModerators', async groupConvo => {
      if (appView) {
        appView.showAddModeratorsDialog(groupConvo);
      }
    });

    Whisper.events.on('removeModerators', async groupConvo => {
      if (appView) {
        appView.showRemoveModeratorsDialog(groupConvo);
      }
    });

    Whisper.events.on('leaveGroup', async groupConvo => {
      if (appView) {
        appView.showLeaveGroupDialog(groupConvo);
      }
    });

    Whisper.Notifications.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        window.inboxStore.dispatch(window.actionsCreators.openConversationExternal(id, messageId));
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

    Whisper.events.on('onShowUserDetails', async ({ userPubKey }) => {
      const conversation = await window
        .getConversationController()
        .getOrCreateAndWait(userPubKey, 'private');

      const avatarPath = conversation.getAvatarPath();
      const profile = conversation.getLokiProfile();
      const displayName = profile && profile.displayName;

      if (appView) {
        appView.showUserDetailsDialog({
          profileName: displayName,
          pubkey: userPubKey,
          avatarPath,
          onStartConversation: () => {
            window.inboxStore.dispatch(
              window.actionsCreators.openConversationExternal(conversation.id)
            );
          },
        });
      }
    });

    Whisper.events.on('showSeedDialog', async () => {
      if (appView) {
        appView.showSeedDialog();
      }
    });

    Whisper.events.on('showPasswordDialog', async options => {
      if (appView) {
        appView.showPasswordDialog(options);
      }
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

    if (messageReceiver) {
      await messageReceiver.close();
    }
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
    if (Whisper.Import.isIncomplete()) {
      return;
    }

    if (messageReceiver) {
      await messageReceiver.close();
    }

    connectCount += 1;
    Whisper.Notifications.disable(); // avoid notification flood until empty
    setTimeout(() => {
      Whisper.Notifications.enable();
    }, window.CONSTANTS.NOTIFICATION_ENABLE_TIMEOUT_SECONDS * 1000);

    // TODO: Investigate the case where we reconnect
    const ourKey = window.libsession.Utils.UserUtils.getOurPubKeyStrFromCache();
    window.SwarmPolling.addPubkey(ourKey);
    window.SwarmPolling.start();

    window.NewReceiver.queueAllCached();

    initAPIs();
    await initSpecialConversations();
    messageReceiver = new textsecure.MessageReceiver();
    messageReceiver.addEventListener('message', window.DataMessageReceiver.handleMessageEvent);
    messageReceiver.addEventListener('sent', window.DataMessageReceiver.handleMessageEvent);
    messageReceiver.addEventListener('reconnect', onReconnect);
    messageReceiver.addEventListener('configuration', onConfiguration);
    // messageReceiver.addEventListener('typing', onTyping);

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
  function onReconnect() {
    // We disable notifications on first connect, but the same applies to reconnect. In
    //   scenarios where we're coming back from sleep, we can get offline/online events
    //   very fast, and it looks like a network blip. But we need to suppress
    //   notifications in these scenarios too. So we listen for 'reconnect' events.
    Whisper.Notifications.disable();

    // Enable back notifications once most messages have been fetched
    setTimeout(() => {
      Whisper.Notifications.enable();
    }, window.CONSTANTS.NOTIFICATION_ENABLE_TIMEOUT_SECONDS * 1000);
  }
  function onConfiguration(ev) {
    const { configuration } = ev;
    const { readReceipts, typingIndicators, linkPreviews } = configuration;

    storage.put('read-receipt-setting', readReceipts);

    if (typingIndicators === true || typingIndicators === false) {
      storage.put('typing-indicators-setting', typingIndicators);
    }

    if (linkPreviews === true || linkPreviews === false) {
      storage.put('link-preview-setting', linkPreviews);
    }

    ev.confirm();
  }
})();
