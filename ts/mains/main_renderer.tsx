import _ from 'lodash';
import { MessageModel } from '../models/message';
import { isMacOS } from '../OS';
import { queueAllCached } from '../receiver/receiver';
import { getConversationController } from '../session/conversations';
import { AttachmentDownloads, ToastUtils } from '../session/utils';
import { getOurPubKeyStrFromCache } from '../session/utils/User';
import { BlockedNumberController } from '../util';
import { ExpirationTimerOptions } from '../util/expiringMessages';
import { Notifications } from '../util/notifications';
import { Registration } from '../util/registration';
import { isSignInByLinking, Storage } from '../util/storage';
import * as Data from '../data/data';
import Backbone from 'backbone';
import { SessionRegistrationView } from '../components/registration/SessionRegistrationView';
import { SessionInboxView } from '../components/SessionInboxView';
import { deleteAllLogs } from '../node/logs';
import ReactDOM from 'react-dom';
import React from 'react';
// tslint:disable: max-classes-per-file

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
function preload(list: Array<string>) {
  // tslint:disable-next-line: one-variable-per-declaration
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

let newVersion = false;

window.document.title = window.getTitle();

// Whisper.events =
// window.Whisper.events = WhisperEvents ?
const WhisperEvents = _.clone(Backbone.Events);
window.Whisper = window.Whisper || {};
window.Whisper.events = WhisperEvents;
window.log.info('Storage fetch');

void Storage.fetch();

function mapOldThemeToNew(theme: string) {
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
Storage.onready(async () => {
  if (!first) {
    return;
  }
  first = false;
  // Update zoom
  window.updateZoomFactor();

  // Ensure accounts created prior to 1.0.0-beta8 do have their
  // 'primaryDevicePubKey' defined.

  if (Registration.isDone() && !Storage.get('primaryDevicePubKey')) {
    await Storage.put('primaryDevicePubKey', getOurPubKeyStrFromCache());
  }

  // These make key operations available to IPC handlers created in preload.js
  window.Events = {
    getThemeSetting: () => Storage.get('theme-setting', 'light'),
    setThemeSetting: async (value: any) => {
      await Storage.put('theme-setting', value);
    },
    getHideMenuBar: () => Storage.get('hide-menu-bar'),
    setHideMenuBar: async (value: boolean) => {
      await Storage.put('hide-menu-bar', value);
      window.setAutoHideMenuBar(false);
      window.setMenuBarVisibility(!value);
    },

    getSpellCheck: () => Storage.get('spell-check', true),
    setSpellCheck: async (value: boolean) => {
      await Storage.put('spell-check', value);
    },

    shutdown: async () => {
      // Stop background processing
      AttachmentDownloads.stop();
      // Stop processing incoming messages
      // FIXME audric stop polling opengroupv2 and swarm nodes

      // Shut down the data interface cleanly
      await Data.shutdown();
    },
  };

  const currentVersion = window.getVersion();
  const lastVersion = Storage.get('version');
  newVersion = !lastVersion || currentVersion !== lastVersion;
  await Storage.put('version', currentVersion);

  if (newVersion) {
    window.log.info(`New version detected: ${currentVersion}; previous: ${lastVersion}`);

    await Data.cleanupOrphanedAttachments();

    await deleteAllLogs();
  }

  const themeSetting = window.Events.getThemeSetting();
  const newThemeSetting = mapOldThemeToNew(themeSetting);
  window.Events.setThemeSetting(newThemeSetting);

  try {
    await AttachmentDownloads.initAttachmentPaths();

    await Promise.all([getConversationController().load(), BlockedNumberController.load()]);
  } catch (error) {
    window.log.error(
      'main_start.js: ConversationController failed to load:',
      error && error.stack ? error.stack : error
    );
  } finally {
    void start();
  }
});

async function manageExpiringData() {
  await Data.cleanSeenMessages();
  await Data.cleanLastHashes();
  setTimeout(manageExpiringData, 1000 * 60 * 60);
}

// tslint:disable-next-line: max-func-body-length
async function start() {
  void manageExpiringData();
  window.dispatchEvent(new Event('storage_ready'));

  window.log.info('Cleanup: starting...');

  const results = await Promise.all([Data.getOutgoingWithoutExpiresAt()]);

  // Combine the models
  const messagesForCleanup = results.reduce(
    (array, current) => array.concat((current as any).toArray()),
    []
  );

  window.log.info(`Cleanup: Found ${messagesForCleanup.length} messages for cleanup`);
  await Promise.all(
    messagesForCleanup.map(async (message: MessageModel) => {
      const sentAt = message.get('sent_at');

      if (message.hasErrors()) {
        return;
      }

      window.log.info(`Cleanup: Deleting unsent message ${sentAt}`);
      await Data.removeMessage(message.id);
    })
  );
  window.log.info('Cleanup: complete');

  window.log.info('listening for registration events');
  WhisperEvents.on('registration_done', async () => {
    window.log.info('handling registration event');

    // Disable link previews as default per Kee
    Storage.onready(async () => {
      await Storage.put('link-preview-setting', false);
    });

    await connect();
  });

  function openInbox() {
    const rtlLocales = ['fa', 'ar', 'he'];

    const loc = (window.i18n as any).getLocale();
    if (rtlLocales.includes(loc) && !document.getElementById('body')?.classList.contains('rtl')) {
      document.getElementById('body')?.classList.add('rtl');
    }
    const hideMenuBar = Storage.get('hide-menu-bar', true) as boolean;
    window.setAutoHideMenuBar(hideMenuBar);
    window.setMenuBarVisibility(!hideMenuBar);
    getConversationController()
      .loadPromise()
      ?.then(() => {
        ReactDOM.render(<SessionInboxView />, document.getElementById('root'));
      });
  }

  function openStandAlone() {
    ReactDOM.render(<SessionRegistrationView />, document.getElementById('root'));
  }
  ExpirationTimerOptions.initExpiringMessageListener();

  if (Registration.isDone() && !isSignInByLinking()) {
    await connect();
    openInbox();
  } else {
    openStandAlone();
  }

  window.addEventListener('focus', () => {
    Notifications.clear();
  });
  window.addEventListener('unload', () => {
    Notifications.fastClear();
  });

  // Set user's launch count.
  const prevLaunchCount = window.getSettingValue('launch-count');
  // tslint:disable-next-line: restrict-plus-operands
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
    ToastUtils.pushRestartNeeded();
  };

  window.toggleMediaPermissions = async () => {
    const value = window.getMediaPermissions();

    if (value === true) {
      const valueCallPermissions = window.getCallMediaPermissions();
      if (valueCallPermissions) {
        window.log.info('toggleMediaPermissions : forcing callPermissions to false');

        await window.toggleCallMediaPermissionsTo(false);
      }
    }

    if (value === false && isMacOS()) {
      window.askForMediaAccess();
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
      if (isMacOS()) {
        window.askForMediaAccess();
      }
      window.log.info('toggleCallMediaPermissionsTo : forcing audio/video to true');
      // turning ON "call permissions" forces turning on "audio/video permissions"
      window.setMediaPermissions(true);
    }
    window.setCallMediaPermissions(enabled);
  };

  window.openFromNotification = async conversationKey => {
    window.showWindow();
    if (conversationKey) {
      // do not put the messageId here so the conversation is loaded on the last unread instead
      await window.openConversationWithMessages({ conversationKey, messageId: null });
    } else {
      openInbox();
    }
  };

  WhisperEvents.on('openInbox', () => {
    openInbox();
  });
}

let disconnectTimer: NodeJS.Timeout | null = null;
function onOffline() {
  window.log.info('offline');
  window.globalOnlineStatus = false;

  window.removeEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  // We've received logs from Linux where we get an 'offline' event, then 30ms later
  //   we get an online event. This waits a bit after getting an 'offline' event
  //   before disconnecting the socket manually.
  disconnectTimer = global.setTimeout(disconnect, 1000);
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

  void connect();
}

function disconnect() {
  window.log.info('disconnect');

  // Clear timer, since we're only called when the timer is expired
  disconnectTimer = null;
  AttachmentDownloads.stop();
}

let connectCount = 0;
async function connect() {
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

  if (!Registration.everDone()) {
    return;
  }

  connectCount += 1;
  Notifications.disable(); // avoid notification flood until empty
  setTimeout(() => {
    Notifications.enable();
  }, 10 * 1000); // 10 sec

  await queueAllCached();
  await AttachmentDownloads.start({
    logger: window.log,
  });

  window.isOnline = true;
}

function onEmpty() {
  window.readyForUpdates();

  Notifications.enable();
}

class TextScramble {
  private frame: any;
  private queue: any;
  private readonly el: any;
  private readonly chars: any;
  private resolve: any;
  private frameRequest: any;

  constructor(el: any) {
    this.el = el;
    this.chars = '0123456789abcdef';
    this.update = this.update.bind(this);
  }
  // tslint:disable: insecure-random

  public async setText(newText: string) {
    const oldText = this.el.value;
    const length = Math.max(oldText.length, newText.length);
    // eslint-disable-next-line no-return-assign
    // tslint:disable-next-line: promise-must-complete
    const promise = new Promise(resolve => (this.resolve = resolve));
    this.queue = [];

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      const startNumber = Math.floor(Math.random() * 40);
      const end = startNumber + Math.floor(Math.random() * 40);
      this.queue.push({
        from,
        to,
        start: startNumber,
        end,
      });
    }

    cancelAnimationFrame(this.frameRequest);
    this.frame = 0;
    this.update();
    return promise;
  }

  public update() {
    let output = '';
    let complete = 0;

    // tslint:disable-next-line: one-variable-per-declaration
    for (let i = 0, n = this.queue.length; i < n; i++) {
      const { from, to, start: startNumber, end } = this.queue[i];
      let { char } = this.queue[i];

      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= startNumber) {
        if (!char || Math.random() < 0.28) {
          char = this.randomChar();
          this.queue[i].char = char;
        }
        output += char;
      } else {
        output += from;
      }
    }

    this.el.value = output;

    if (complete === this.queue.length) {
      this.resolve();
    } else {
      this.frameRequest = requestAnimationFrame(this.update);
      this.frame++;
    }
  }

  public randomChar() {
    return this.chars[Math.floor(Math.random() * this.chars.length)];
  }
}
window.Session = window.Session || {};

window.Session.setNewSessionID = (sessionID: string) => {
  const el = document.querySelector('.session-id-editable-textarea');
  const fx = new TextScramble(el);
  if (el) {
    (el as any).value = sessionID;
  }
  void fx.setText(sessionID);
};
