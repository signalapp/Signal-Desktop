/* global window: false */
/* global callWorker: false */
/* global textsecure: false */
/* global Event: false */
/* global dcodeIO: false */
/* global lokiPublicChatAPI: false */

/* eslint-disable more/no-then */
/* eslint-disable no-unreachable */

let openGroupBound = false;

function MessageReceiver() {
  this.pending = Promise.resolve();

  // only do this once to prevent duplicates
  if (lokiPublicChatAPI) {
    window.log.info('Binding open group events handler', openGroupBound);
    if (!openGroupBound) {
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
MessageReceiver.arrayBufferToStringBase64 = arrayBuffer =>
  callWorker('arrayBufferToStringBase64', arrayBuffer);

MessageReceiver.prototype = new textsecure.EventTarget();
MessageReceiver.prototype.extend({
  constructor: MessageReceiver,
  connect() {
    if (this.calledClose) {
      return;
    }

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
  },
  onopen() {},
  onerror() {},
  onclose() {},
});

window.textsecure = window.textsecure || {};

textsecure.MessageReceiver = function MessageReceiverWrapper() {
  const messageReceiver = new MessageReceiver();
  this.addEventListener = messageReceiver.addEventListener.bind(
    messageReceiver
  );
  this.removeEventListener = messageReceiver.removeEventListener.bind(
    messageReceiver
  );
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
textsecure.MessageReceiver.arrayBufferToStringBase64 =
  MessageReceiver.arrayBufferToStringBase64;
