/* global window: false */
/* global callWorker: false */
/* global textsecure: false */
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
  this.server = WebAPI.connect();

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
        window.NewReceiver.handleUnencryptedMessage
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
      feed.on('rssMessage', window.NewReceiver.handleUnencryptedMessage);
    });

    // Ensures that an immediate 'empty' event from the websocket will fire only after
    //   all cached envelopes are processed.
    this.incoming = [this.pending];
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
  onclose(ev) {
    window.log.info(
      'websocket closed',
      ev.code,
      ev.reason || '',
      'calledClose:',
      this.calledClose
    );
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
