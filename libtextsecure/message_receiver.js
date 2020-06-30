/* global window: false */
/* global callWorker: false */
/* global textsecure: false */
/* global libsignal: false */
/* global WebSocket: false */
/* global Event: false */
/* global dcodeIO: false */
/* global lokiPublicChatAPI: false */
/* global feeds: false */
/* global WebAPI: false */

/* eslint-disable more/no-then */
/* eslint-disable no-unreachable */

let openGroupBound = false;

function MessageReceiver(username, password, signalingKey) {
  this.count = 0;

  this.signalingKey = signalingKey;
  this.username = username;
  this.password = password;
  this.server = WebAPI.connect();

  const address = libsignal.SignalProtocolAddress.fromString(username);
  this.number = address.getName();
  this.deviceId = address.getDeviceId();

  this.pending = Promise.resolve();

  // only do this once to prevent duplicates
  if (lokiPublicChatAPI) {
    window.log.info('Binding open group events handler', openGroupBound);
    if (!openGroupBound) {
      // clear any previous binding
      lokiPublicChatAPI.removeAllListeners('publicMessage');
      // we only need one MR in the system handling these
      // bind events
      lokiPublicChatAPI.on(
        'publicMessage',
        this.handleUnencryptedMessage.bind(this)
      );
      openGroupBound = true;
    }
  } else {
    window.log.warn('Can not handle open group data, API is not available');
  }
}

MessageReceiver.stringToArrayBuffer = string =>
  Promise.resolve(dcodeIO.ByteBuffer.wrap(string, 'binary').toArrayBuffer());
MessageReceiver.arrayBufferToString = arrayBuffer =>
  Promise.resolve(dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('binary'));

MessageReceiver.stringToArrayBufferBase64 = string =>
  callWorker('stringToArrayBufferBase64', string);
MessageReceiver.arrayBufferToStringBase64 = arrayBuffer =>
  callWorker('arrayBufferToStringBase64', arrayBuffer);

MessageReceiver.prototype = new textsecure.EventTarget();
MessageReceiver.prototype.extend({
  constructor: MessageReceiver,
  connect() {
    if (this.calledClose) {
      return;
    }

    this.count = 0;
    if (this.hasConnected) {
      const ev = new Event('reconnect');
      this.dispatchEvent(ev);
    }

    this.hasConnected = true;

    // start polling all open group rooms you have registered
    // if not registered yet, they'll get started when they're created
    if (lokiPublicChatAPI) {
      lokiPublicChatAPI.open();
    }
    // set up pollers for any RSS feeds
    feeds.forEach(feed => {
      feed.on('rssMessage', this.handleUnencryptedMessage.bind(this));
    });

    // Ensures that an immediate 'empty' event from the websocket will fire only after
    //   all cached envelopes are processed.
    this.incoming = [this.pending];
  },
  async handleUnencryptedMessage({ message }) {
    const isMe = message.source === textsecure.storage.user.getNumber();
    if (!isMe && message.message.profile) {
      const conversation = await window.ConversationController.getOrCreateAndWait(
        message.source,
        'private'
      );
      await window.NewReceiver.updateProfile(
        conversation,
        message.message.profile,
        message.message.profileKey
      );
    }

    const ourNumber = textsecure.storage.user.getNumber();
    const primaryDevice = window.storage.get('primaryDevicePubKey');
    const isOurDevice =
      message.source &&
      (message.source === ourNumber || message.source === primaryDevice);
    const isPublicChatMessage =
      message.message.group &&
      message.message.group.id &&
      !!message.message.group.id.match(/^publicChat:/);
    let ev;

    if (isPublicChatMessage && isOurDevice) {
      // Public chat messages from ourselves should be outgoing
      ev = new Event('sent');
    } else {
      ev = new Event('message');
    }
    ev.confirm = function confirmTerm() {};
    ev.data = message;
    this.dispatchAndWait(ev);
  },
  stopProcessing() {
    window.log.info('MessageReceiver: stopProcessing requested');
    this.stoppingProcessing = true;
    return this.close();
  },
  shutdown() {},
  async close() {
    window.log.info('MessageReceiver.close()');
    this.calledClose = true;

    // stop polling all open group rooms
    if (lokiPublicChatAPI) {
      await lokiPublicChatAPI.close();
    }

    return this.drain();
  },
  onopen() {
    window.log.info('websocket open');
  },
  onerror() {
    window.log.error('websocket error');
  },
  dispatchAndWait(event) {
    const promise = this.appPromise || Promise.resolve();
    const appJobPromise = Promise.all(this.dispatchEvent(event));
    const job = () => appJobPromise;

    this.appPromise = promise.then(job, job);

    return Promise.resolve();
  },
  onclose(ev) {
    window.log.info(
      'websocket closed',
      ev.code,
      ev.reason || '',
      'calledClose:',
      this.calledClose
    );
  },

  onEmpty() {
    const { incoming } = this;
    this.incoming = [];

    const emitEmpty = () => {
      window.log.info("MessageReceiver: emitting 'empty' event");
      const ev = new Event('empty');
      this.dispatchAndWait(ev);
    };

    const waitForApplication = async () => {
      window.log.info(
        "MessageReceiver: finished processing messages after 'empty', now waiting for application"
      );
      const promise = this.appPromise || Promise.resolve();
      this.appPromise = Promise.resolve();

      // We don't await here because we don't this to gate future message processing
      promise.then(emitEmpty, emitEmpty);
    };

    const waitForEmptyQueue = () => {
      // resetting count to zero so everything queued after this starts over again
      this.count = 0;

      this.addToQueue(waitForApplication);
    };

    // We first wait for all recently-received messages (this.incoming) to be queued,
    //   then we queue a task to wait for the application to finish its processing, then
    //   finally we emit the 'empty' event to the queue.
    Promise.all(incoming).then(waitForEmptyQueue, waitForEmptyQueue);
  },
  drain() {
    const { incoming } = this;
    this.incoming = [];

    // This promise will resolve when there are no more messages to be processed.
    return Promise.all(incoming);
  },
  updateProgress(count) {
    // count by 10s
    if (count % 10 !== 0) {
      return;
    }
    const ev = new Event('progress');
    ev.count = count;
    this.dispatchEvent(ev);
  },
  getStatus() {
    if (this.hasConnected) {
      return WebSocket.CLOSED;
    }
    return -1;
  },
  unpad(paddedData) {
    const paddedPlaintext = new Uint8Array(paddedData);
    let plaintext;

    for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
      if (paddedPlaintext[i] === 0x80) {
        plaintext = new Uint8Array(i);
        plaintext.set(paddedPlaintext.subarray(0, i));
        plaintext = plaintext.buffer;
        break;
      } else if (paddedPlaintext[i] !== 0x00) {
        throw new Error('Invalid padding');
      }
    }

    return plaintext;
  },
  async decryptPreKeyWhisperMessage(ciphertext, sessionCipher, address) {
    const padded = await sessionCipher.decryptPreKeyWhisperMessage(ciphertext);

    try {
      return this.unpad(padded);
    } catch (e) {
      if (e.message === 'Unknown identity key') {
        // create an error that the UI will pick up and ask the
        // user if they want to re-negotiate
        const buffer = dcodeIO.ByteBuffer.wrap(ciphertext);
        throw new textsecure.IncomingIdentityKeyError(
          address.toString(),
          buffer.toArrayBuffer(),
          e.identityKey
        );
      }
      throw e;
    }
  },
});

window.textsecure = window.textsecure || {};

textsecure.MessageReceiver = function MessageReceiverWrapper(
  username,
  password,
  signalingKey,
  options
) {
  const messageReceiver = new MessageReceiver(
    username,
    password,
    signalingKey,
    options
  );
  this.addEventListener = messageReceiver.addEventListener.bind(
    messageReceiver
  );
  this.removeEventListener = messageReceiver.removeEventListener.bind(
    messageReceiver
  );
  this.getStatus = messageReceiver.getStatus.bind(messageReceiver);
  this.close = messageReceiver.close.bind(messageReceiver);

  this.stopProcessing = messageReceiver.stopProcessing.bind(messageReceiver);

  messageReceiver.connect();
};

textsecure.MessageReceiver.prototype = {
  constructor: textsecure.MessageReceiver,
};

textsecure.MessageReceiver.stringToArrayBuffer =
  MessageReceiver.stringToArrayBuffer;
textsecure.MessageReceiver.arrayBufferToString =
  MessageReceiver.arrayBufferToString;
textsecure.MessageReceiver.stringToArrayBufferBase64 =
  MessageReceiver.stringToArrayBufferBase64;
textsecure.MessageReceiver.arrayBufferToStringBase64 =
  MessageReceiver.arrayBufferToStringBase64;
