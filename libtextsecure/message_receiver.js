/* global window: false */
/* global textsecure: false */
/* global TextSecureServer: false */
/* global libsignal: false */
/* global WebSocketResource: false */
/* global WebSocket: false */
/* global Event: false */
/* global dcodeIO: false */
/* global _: false */
/* global ContactBuffer: false */
/* global GroupBuffer: false */

/* eslint-disable more/no-then */

function MessageReceiver(url, username, password, signalingKey, options = {}) {
  this.count = 0;

  this.url = url;
  this.signalingKey = signalingKey;
  this.username = username;
  this.password = password;
  this.server = new TextSecureServer(url, username, password);

  const address = libsignal.SignalProtocolAddress.fromString(username);
  this.number = address.getName();
  this.deviceId = address.getDeviceId();

  this.pending = Promise.resolve();

  if (options.retryCached) {
    this.pending = this.queueAllCached();
  }
}

MessageReceiver.prototype = new textsecure.EventTarget();
MessageReceiver.prototype.extend({
  constructor: MessageReceiver,
  connect() {
    if (this.calledClose) {
      return;
    }

    this.hasConnected = true;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
      this.wsr.close();
    }
    // initialize the socket and start listening for messages
    this.socket = this.server.getMessageSocket();
    this.socket.onclose = this.onclose.bind(this);
    this.socket.onerror = this.onerror.bind(this);
    this.socket.onopen = this.onopen.bind(this);
    this.wsr = new WebSocketResource(this.socket, {
      handleRequest: this.handleRequest.bind(this),
      keepalive: {
        path: '/v1/keepalive',
        disconnect: true,
      },
    });

    // Because sometimes the socket doesn't properly emit its close event
    this._onClose = this.onclose.bind(this);
    this.wsr.addEventListener('close', this._onClose);

    // Ensures that an immediate 'empty' event from the websocket will fire only after
    //   all cached envelopes are processed.
    this.incoming = [this.pending];
  },
  shutdown() {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket = null;
    }

    if (this.wsr) {
      this.wsr.removeEventListener('close', this._onClose);
      this.wsr = null;
    }
  },
  close() {
    console.log('MessageReceiver.close()');
    this.calledClose = true;

    // Our WebSocketResource instance will close the socket and emit a 'close' event
    //   if the socket doesn't emit one quickly enough.
    if (this.wsr) {
      this.wsr.close(3000, 'called close');
    }

    return this.drain();
  },
  onopen() {
    console.log('websocket open');
  },
  onerror() {
    console.log('websocket error');
  },
  dispatchAndWait(event) {
    return Promise.all(this.dispatchEvent(event));
  },
  onclose(ev) {
    console.log(
      'websocket closed',
      ev.code,
      ev.reason || '',
      'calledClose:',
      this.calledClose
    );

    this.shutdown();

    if (this.calledClose) {
      return Promise.resolve();
    }
    if (ev.code === 3000) {
      return Promise.resolve();
    }
    if (ev.code === 3001) {
      this.onEmpty();
    }
    // possible 403 or network issue. Make an request to confirm
    return this.server.getDevices(this.number)
      .then(this.connect.bind(this)) // No HTTP error? Reconnect
      .catch((e) => {
        const event = new Event('error');
        event.error = e;
        return this.dispatchAndWait(event);
      });
  },
  handleRequest(request) {
    this.incoming = this.incoming || [];
    // We do the message decryption here, instead of in the ordered pending queue,
    // to avoid exposing the time it took us to process messages through the time-to-ack.

    // TODO: handle different types of requests.
    if (request.path !== '/api/v1/message') {
      console.log('got request', request.verb, request.path);
      request.respond(200, 'OK');

      if (request.verb === 'PUT' && request.path === '/api/v1/queue/empty') {
        this.onEmpty();
      }
      return;
    }

    const promise = textsecure.crypto.decryptWebsocketMessage(
      request.body,
      this.signalingKey
    ).then((plaintext) => {
      const envelope = textsecure.protobuf.Envelope.decode(plaintext);
      // After this point, decoding errors are not the server's
      //   fault, and we should handle them gracefully and tell the
      //   user they received an invalid message

      if (this.isBlocked(envelope.source)) {
        return request.respond(200, 'OK');
      }

      return this.addToCache(envelope, plaintext).then(() => {
        request.respond(200, 'OK');
        this.queueEnvelope(envelope);
      }, (error) => {
        console.log(
          'handleRequest error trying to add message to cache:',
          error && error.stack ? error.stack : error
        );
      });
    }).catch((e) => {
      request.respond(500, 'Bad encrypted websocket message');
      console.log('Error handling incoming message:', e && e.stack ? e.stack : e);
      const ev = new Event('error');
      ev.error = e;
      return this.dispatchAndWait(ev);
    });

    this.incoming.push(promise);
  },
  addToQueue(task) {
    this.count += 1;
    this.pending = this.pending.then(task, task);

    const { count, pending } = this;

    const cleanup = () => {
      this.updateProgress(count);
      // We want to clear out the promise chain whenever possible because it could
      //   lead to large memory usage over time:
      //   https://github.com/nodejs/node/issues/6673#issuecomment-244331609
      if (this.pending === pending) {
        this.pending = Promise.resolve();
      }
    };

    pending.then(cleanup, cleanup);

    return pending;
  },
  onEmpty() {
    const { incoming } = this;
    this.incoming = [];

    const dispatchEmpty = () => {
      console.log('MessageReceiver: emitting \'empty\' event');
      const ev = new Event('empty');
      return this.dispatchAndWait(ev);
    };

    const queueDispatch = () => {
      // resetting count to zero so everything queued after this starts over again
      this.count = 0;

      this.addToQueue(dispatchEmpty);
    };

    // We first wait for all recently-received messages (this.incoming) to be queued,
    //   then we add a task to emit the 'empty' event to the queue, so all message
    //   processing is complete by the time it runs.
    Promise.all(incoming).then(queueDispatch, queueDispatch);
  },
  drain() {
    const { incoming } = this;
    this.incoming = [];

    const queueDispatch = () => this.addToQueue(() => {
      console.log('drained');
    });

    // This promise will resolve when there are no more messages to be processed.
    return Promise.all(incoming).then(queueDispatch, queueDispatch);
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
  queueAllCached() {
    return this.getAllFromCache().then((items) => {
      for (let i = 0, max = items.length; i < max; i += 1) {
        this.queueCached(items[i]);
      }
    });
  },
  queueCached(item) {
    try {
      let envelopePlaintext = item.envelope;

      // Up until 0.42.6 we stored envelope and decrypted as strings in IndexedDB,
      //   so we need to be ready for them.
      if (typeof envelopePlaintext === 'string') {
        envelopePlaintext = this.stringToArrayBuffer(envelopePlaintext);
      }
      const envelope = textsecure.protobuf.Envelope.decode(envelopePlaintext);

      const { decrypted } = item;
      if (decrypted) {
        let payloadPlaintext = decrypted;
        if (typeof payloadPlaintext === 'string') {
          payloadPlaintext = this.stringToArrayBuffer(payloadPlaintext);
        }
        this.queueDecryptedEnvelope(envelope, payloadPlaintext);
      } else {
        this.queueEnvelope(envelope);
      }
    } catch (error) {
      console.log('queueCached error handling item', item.id);
    }
  },
  getEnvelopeId(envelope) {
    return `${envelope.source}.${envelope.sourceDevice} ${envelope.timestamp.toNumber()}`;
  },
  stringToArrayBuffer(string) {
    // eslint-disable-next-line new-cap
    return new dcodeIO.ByteBuffer.wrap(string, 'binary').toArrayBuffer();
  },
  getAllFromCache() {
    console.log('getAllFromCache');
    return textsecure.storage.unprocessed.getAll().then((items) => {
      console.log('getAllFromCache loaded', items.length, 'saved envelopes');

      return Promise.all(_.map(items, (item) => {
        const attempts = 1 + (item.attempts || 0);
        if (attempts >= 5) {
          console.log('getAllFromCache final attempt for envelope', item.id);
          return textsecure.storage.unprocessed.remove(item.id);
        }
        return textsecure.storage.unprocessed.update(item.id, { attempts });
      })).then(() => items, (error) => {
        console.log(
          'getAllFromCache error updating items after load:',
          error && error.stack ? error.stack : error
        );
        return items;
      });
    });
  },
  addToCache(envelope, plaintext) {
    const id = this.getEnvelopeId(envelope);
    const data = {
      id,
      envelope: plaintext,
      timestamp: Date.now(),
      attempts: 1,
    };
    return textsecure.storage.unprocessed.add(data);
  },
  updateCache(envelope, plaintext) {
    const id = this.getEnvelopeId(envelope);
    const data = {
      decrypted: plaintext,
    };
    return textsecure.storage.unprocessed.update(id, data);
  },
  removeFromCache(envelope) {
    const id = this.getEnvelopeId(envelope);
    return textsecure.storage.unprocessed.remove(id);
  },
  queueDecryptedEnvelope(envelope, plaintext) {
    const id = this.getEnvelopeId(envelope);
    console.log('queueing decrypted envelope', id);

    const task = this.handleDecryptedEnvelope.bind(this, envelope, plaintext);
    const taskWithTimeout = textsecure.createTaskWithTimeout(
      task,
      `queueEncryptedEnvelope ${id}`
    );
    const promise = this.addToQueue(taskWithTimeout);

    return promise.catch((error) => {
      console.log(
        'queueDecryptedEnvelope error handling envelope',
        id,
        ':',
        error && error.stack ? error.stack : error
      );
    });
  },
  queueEnvelope(envelope) {
    const id = this.getEnvelopeId(envelope);
    console.log('queueing envelope', id);

    const task = this.handleEnvelope.bind(this, envelope);
    const taskWithTimeout = textsecure.createTaskWithTimeout(task, `queueEnvelope ${id}`);
    const promise = this.addToQueue(taskWithTimeout);

    return promise.catch((error) => {
      console.log(
        'queueEnvelope error handling envelope',
        id,
        ':',
        error && error.stack ? error.stack : error
      );
    });
  },
  // Same as handleEnvelope, just without the decryption step. Necessary for handling
  //   messages which were successfully decrypted, but application logic didn't finish
  //   processing.
  handleDecryptedEnvelope(envelope, plaintext) {
    // No decryption is required for delivery receipts, so the decrypted field of
    //   the Unprocessed model will never be set

    if (envelope.content) {
      return this.innerHandleContentMessage(envelope, plaintext);
    } else if (envelope.legacyMessage) {
      return this.innerHandleLegacyMessage(envelope, plaintext);
    }
    this.removeFromCache(envelope);
    throw new Error('Received message with no content and no legacyMessage');
  },
  handleEnvelope(envelope) {
    if (envelope.type === textsecure.protobuf.Envelope.Type.RECEIPT) {
      return this.onDeliveryReceipt(envelope);
    }

    if (envelope.content) {
      return this.handleContentMessage(envelope);
    } else if (envelope.legacyMessage) {
      return this.handleLegacyMessage(envelope);
    }
    this.removeFromCache(envelope);
    throw new Error('Received message with no content and no legacyMessage');
  },
  getStatus() {
    if (this.socket) {
      return this.socket.readyState;
    } else if (this.hasConnected) {
      return WebSocket.CLOSED;
    }
    return -1;
  },
  onDeliveryReceipt(envelope) {
    return new Promise((resolve, reject) => {
      const ev = new Event('delivery');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      ev.deliveryReceipt = {
        timestamp: envelope.timestamp.toNumber(),
        source: envelope.source,
        sourceDevice: envelope.sourceDevice,
      };
      this.dispatchAndWait(ev).then(resolve, reject);
    });
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
  decrypt(envelope, ciphertext) {
    let promise;
    const address = new libsignal.SignalProtocolAddress(
      envelope.source,
      envelope.sourceDevice
    );

    const ourNumber = textsecure.storage.user.getNumber();
    const number = address.toString().split('.')[0];
    const options = {};

    // No limit on message keys if we're communicating with our other devices
    if (ourNumber === number) {
      options.messageKeysLimit = false;
    }

    const sessionCipher = new libsignal.SessionCipher(
      textsecure.storage.protocol,
      address,
      options
    );

    switch (envelope.type) {
      case textsecure.protobuf.Envelope.Type.CIPHERTEXT:
        console.log('message from', this.getEnvelopeId(envelope));
        promise = sessionCipher.decryptWhisperMessage(ciphertext).then(this.unpad);
        break;
      case textsecure.protobuf.Envelope.Type.PREKEY_BUNDLE:
        console.log('prekey message from', this.getEnvelopeId(envelope));
        promise = this.decryptPreKeyWhisperMessage(ciphertext, sessionCipher, address);
        break;
      default:
        promise = Promise.reject(new Error('Unknown message type'));
    }

    return promise.then(plaintext => this.updateCache(
      envelope,
      plaintext
    ).then(() => plaintext, (error) => {
      console.log(
        'decrypt failed to save decrypted message contents to cache:',
        error && error.stack ? error.stack : error
      );
      return plaintext;
    })).catch((error) => {
      let errorToThrow = error;

      if (error.message === 'Unknown identity key') {
        // create an error that the UI will pick up and ask the
        // user if they want to re-negotiate
        const buffer = dcodeIO.ByteBuffer.wrap(ciphertext);
        errorToThrow = new textsecure.IncomingIdentityKeyError(
          address.toString(),
          buffer.toArrayBuffer(),
          error.identityKey
        );
      }
      const ev = new Event('error');
      ev.error = errorToThrow;
      ev.proto = envelope;
      ev.confirm = this.removeFromCache.bind(this, envelope);

      const returnError = () => Promise.reject(errorToThrow);
      return this.dispatchAndWait(ev).then(returnError, returnError);
    });
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
  handleSentMessage(envelope, destination, timestamp, msg, expirationStartTimestamp) {
    let p = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    if (msg.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(destination);
    }
    return p.then(() => this.processDecrypted(
      envelope,
      msg,
      this.number
    ).then((message) => {
      const ev = new Event('sent');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      ev.data = {
        destination,
        timestamp: timestamp.toNumber(),
        device: envelope.sourceDevice,
        message,
      };
      if (expirationStartTimestamp) {
        ev.data.expirationStartTimestamp = expirationStartTimestamp.toNumber();
      }
      return this.dispatchAndWait(ev);
    }));
  },
  handleDataMessage(envelope, msg) {
    console.log('data message from', this.getEnvelopeId(envelope));
    let p = Promise.resolve();
    // eslint-disable-next-line no-bitwise
    if (msg.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION) {
      p = this.handleEndSession(envelope.source);
    }
    return p.then(() => this.processDecrypted(
      envelope,
      msg,
      envelope.source
    ).then((message) => {
      const ev = new Event('message');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      ev.data = {
        source: envelope.source,
        sourceDevice: envelope.sourceDevice,
        timestamp: envelope.timestamp.toNumber(),
        receivedAt: envelope.receivedAt,
        message,
      };
      return this.dispatchAndWait(ev);
    }));
  },
  handleLegacyMessage(envelope) {
    return this.decrypt(
      envelope,
      envelope.legacyMessage
    ).then(plaintext => this.innerHandleLegacyMessage(envelope, plaintext));
  },
  innerHandleLegacyMessage(envelope, plaintext) {
    const message = textsecure.protobuf.DataMessage.decode(plaintext);
    return this.handleDataMessage(envelope, message);
  },
  handleContentMessage(envelope) {
    return this.decrypt(
      envelope,
      envelope.content
    ).then(plaintext => this.innerHandleContentMessage(envelope, plaintext));
  },
  innerHandleContentMessage(envelope, plaintext) {
    const content = textsecure.protobuf.Content.decode(plaintext);
    if (content.syncMessage) {
      return this.handleSyncMessage(envelope, content.syncMessage);
    } else if (content.dataMessage) {
      return this.handleDataMessage(envelope, content.dataMessage);
    } else if (content.nullMessage) {
      return this.handleNullMessage(envelope, content.nullMessage);
    } else if (content.callMessage) {
      return this.handleCallMessage(envelope, content.callMessage);
    } else if (content.receiptMessage) {
      return this.handleReceiptMessage(envelope, content.receiptMessage);
    }
    this.removeFromCache(envelope);
    throw new Error('Unsupported content message');
  },
  handleCallMessage(envelope) {
    console.log('call message from', this.getEnvelopeId(envelope));
    this.removeFromCache(envelope);
  },
  handleReceiptMessage(envelope, receiptMessage) {
    const results = [];
    if (receiptMessage.type === textsecure.protobuf.ReceiptMessage.Type.DELIVERY) {
      for (let i = 0; i < receiptMessage.timestamp.length; i += 1) {
        const ev = new Event('delivery');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.deliveryReceipt = {
          timestamp: receiptMessage.timestamp[i].toNumber(),
          source: envelope.source,
          sourceDevice: envelope.sourceDevice,
        };
        results.push(this.dispatchAndWait(ev));
      }
    } else if (receiptMessage.type === textsecure.protobuf.ReceiptMessage.Type.READ) {
      for (let i = 0; i < receiptMessage.timestamp.length; i += 1) {
        const ev = new Event('read');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.timestamp = envelope.timestamp.toNumber();
        ev.read = {
          timestamp: receiptMessage.timestamp[i].toNumber(),
          reader: envelope.source,
        };
        results.push(this.dispatchAndWait(ev));
      }
    }
    return Promise.all(results);
  },
  handleNullMessage(envelope) {
    console.log('null message from', this.getEnvelopeId(envelope));
    this.removeFromCache(envelope);
  },
  handleSyncMessage(envelope, syncMessage) {
    if (envelope.source !== this.number) {
      throw new Error('Received sync message from another number');
    }
    // eslint-disable-next-line eqeqeq
    if (envelope.sourceDevice == this.deviceId) {
      throw new Error('Received sync message from our own device');
    }
    if (syncMessage.sent) {
      const sentMessage = syncMessage.sent;
      const to = sentMessage.message.group
        ? `group(${sentMessage.message.group.id.toBinary()})`
        : sentMessage.destination;

      console.log(
        'sent message to',
        to,
        sentMessage.timestamp.toNumber(),
        'from',
        this.getEnvelopeId(envelope)
      );
      return this.handleSentMessage(
        envelope,
        sentMessage.destination,
        sentMessage.timestamp,
        sentMessage.message,
        sentMessage.expirationStartTimestamp
      );
    } else if (syncMessage.contacts) {
      return this.handleContacts(envelope, syncMessage.contacts);
    } else if (syncMessage.groups) {
      return this.handleGroups(envelope, syncMessage.groups);
    } else if (syncMessage.blocked) {
      return this.handleBlocked(envelope, syncMessage.blocked);
    } else if (syncMessage.request) {
      console.log('Got SyncMessage Request');
      return this.removeFromCache(envelope);
    } else if (syncMessage.read && syncMessage.read.length) {
      console.log('read messages from', this.getEnvelopeId(envelope));
      return this.handleRead(envelope, syncMessage.read);
    } else if (syncMessage.verified) {
      return this.handleVerified(envelope, syncMessage.verified);
    } else if (syncMessage.configuration) {
      return this.handleConfiguration(envelope, syncMessage.configuration);
    }
    throw new Error('Got empty SyncMessage');
  },
  handleConfiguration(envelope, configuration) {
    const ev = new Event('configuration');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.configuration = {
      readReceipts: configuration.readReceipts,
    };
    return this.dispatchAndWait(ev);
  },
  handleVerified(envelope, verified) {
    const ev = new Event('verified');
    ev.confirm = this.removeFromCache.bind(this, envelope);
    ev.verified = {
      state: verified.state,
      destination: verified.destination,
      identityKey: verified.identityKey.toArrayBuffer(),
    };
    return this.dispatchAndWait(ev);
  },
  handleRead(envelope, read) {
    const results = [];
    for (let i = 0; i < read.length; i += 1) {
      const ev = new Event('readSync');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      ev.timestamp = envelope.timestamp.toNumber();
      ev.read = {
        timestamp: read[i].timestamp.toNumber(),
        sender: read[i].sender,
      };
      results.push(this.dispatchAndWait(ev));
    }
    return Promise.all(results);
  },
  handleContacts(envelope, contacts) {
    console.log('contact sync');
    const attachmentPointer = contacts.blob;
    return this.handleAttachment(attachmentPointer).then(() => {
      const results = [];
      const contactBuffer = new ContactBuffer(attachmentPointer.data);
      let contactDetails = contactBuffer.next();
      while (contactDetails !== undefined) {
        const ev = new Event('contact');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        ev.contactDetails = contactDetails;
        results.push(this.dispatchAndWait(ev));

        contactDetails = contactBuffer.next();
      }

      const ev = new Event('contactsync');
      ev.confirm = this.removeFromCache.bind(this, envelope);
      results.push(this.dispatchAndWait(ev));

      return Promise.all(results);
    });
  },
  handleGroups(envelope, groups) {
    console.log('group sync');
    const attachmentPointer = groups.blob;
    return this.handleAttachment(attachmentPointer).then(() => {
      const groupBuffer = new GroupBuffer(attachmentPointer.data);
      let groupDetails = groupBuffer.next();
      const promises = [];
      while (groupDetails !== undefined) {
        const getGroupDetails = (details) => {
          // eslint-disable-next-line no-param-reassign
          details.id = details.id.toBinary();
          if (details.active) {
            return textsecure.storage.groups.getGroup(details.id)
              .then((existingGroup) => {
                if (existingGroup === undefined) {
                  return textsecure.storage.groups.createNewGroup(
                    details.members,
                    details.id
                  );
                }
                return textsecure.storage.groups.updateNumbers(
                  details.id,
                  details.members
                );
              }).then(() => details);
          }
          return Promise.resolve(details);
        };

        const promise = getGroupDetails(groupDetails).then((details) => {
          const ev = new Event('group');
          ev.confirm = this.removeFromCache.bind(this, envelope);
          ev.groupDetails = details;
          return this.dispatchAndWait(ev);
        }).catch((e) => {
          console.log('error processing group', e);
        });
        groupDetails = groupBuffer.next();
        promises.push(promise);
      }

      Promise.all(promises).then(() => {
        const ev = new Event('groupsync');
        ev.confirm = this.removeFromCache.bind(this, envelope);
        return this.dispatchAndWait(ev);
      });
    });
  },
  handleBlocked(envelope, blocked) {
    console.log('Setting these numbers as blocked:', blocked.numbers);
    textsecure.storage.put('blocked', blocked.numbers);
  },
  isBlocked(number) {
    return textsecure.storage.get('blocked', []).indexOf(number) >= 0;
  },
  handleAttachment(attachment) {
    // eslint-disable-next-line no-param-reassign
    attachment.id = attachment.id.toString();
    // eslint-disable-next-line no-param-reassign
    attachment.key = attachment.key.toArrayBuffer();
    if (attachment.digest) {
      // eslint-disable-next-line no-param-reassign
      attachment.digest = attachment.digest.toArrayBuffer();
    }
    function decryptAttachment(encrypted) {
      return textsecure.crypto.decryptAttachment(
        encrypted,
        attachment.key,
        attachment.digest
      );
    }

    function updateAttachment(data) {
      // eslint-disable-next-line no-param-reassign
      attachment.data = data;
    }

    return this.server.getAttachment(attachment.id)
      .then(decryptAttachment)
      .then(updateAttachment);
  },
  validateRetryContentMessage(content) {
    // Today this is only called for incoming identity key errors, so it can't be a sync
    //   message.
    if (content.syncMessage) {
      return false;
    }

    // We want at least one field set, but not more than one
    let count = 0;
    count += content.dataMessage ? 1 : 0;
    count += content.callMessage ? 1 : 0;
    count += content.nullMessage ? 1 : 0;
    if (count !== 1) {
      return false;
    }

    // It's most likely that dataMessage will be populated, so we look at it in detail
    const data = content.dataMessage;
    if (data && !data.attachments.length && !data.body && !data.expireTimer &&
      !data.flags && !data.group) {
      return false;
    }

    return true;
  },
  tryMessageAgain(from, ciphertext, message) {
    const address = libsignal.SignalProtocolAddress.fromString(from);
    const sentAt = message.sent_at || Date.now();
    const receivedAt = message.received_at || Date.now();

    const ourNumber = textsecure.storage.user.getNumber();
    const number = address.getName();
    const device = address.getDeviceId();
    const options = {};

    // No limit on message keys if we're communicating with our other devices
    if (ourNumber === number) {
      options.messageKeysLimit = false;
    }

    const sessionCipher = new libsignal.SessionCipher(
      textsecure.storage.protocol,
      address,
      options
    );
    console.log('retrying prekey whisper message');
    return this.decryptPreKeyWhisperMessage(
      ciphertext,
      sessionCipher,
      address
    ).then((plaintext) => {
      const envelope = {
        source: number,
        sourceDevice: device,
        receivedAt,
        timestamp: {
          toNumber() {
            return sentAt;
          },
        },
      };

      // Before June, all incoming messages were still DataMessage:
      //   - iOS: Michael Kirk says that they were sending Legacy messages until June
      //   - Desktop: https://github.com/signalapp/Signal-Desktop/commit/e8548879db405d9bcd78b82a456ad8d655592c0f
      //   - Android: https://github.com/signalapp/libsignal-service-java/commit/61a75d023fba950ff9b4c75a249d1a3408e12958
      //
      // var d = new Date('2017-06-01T07:00:00.000Z');
      // d.getTime();
      const startOfJune = 1496300400000;
      if (sentAt < startOfJune) {
        return this.innerHandleLegacyMessage(envelope, plaintext);
      }

      // This is ugly. But we don't know what kind of proto we need to decode...
      try {
        // Simply decoding as a Content message may throw
        const content = textsecure.protobuf.Content.decode(plaintext);

        // But it might also result in an invalid object, so we try to detect that
        if (this.validateRetryContentMessage(content)) {
          return this.innerHandleContentMessage(envelope, plaintext);
        }
      } catch (e) {
        return this.innerHandleLegacyMessage(envelope, plaintext);
      }

      return this.innerHandleLegacyMessage(envelope, plaintext);
    });
  },
  async handleEndSession(number) {
    console.log('got end session');
    const deviceIds = await textsecure.storage.protocol.getDeviceIds(number);

    return Promise.all(deviceIds.map((deviceId) => {
      const address = new libsignal.SignalProtocolAddress(number, deviceId);
      const sessionCipher = new libsignal.SessionCipher(
        textsecure.storage.protocol,
        address
      );

      console.log('deleting sessions for', address.toString());
      return sessionCipher.deleteAllSessionsForDevice();
    }));
  },
  processDecrypted(envelope, decrypted, source) {
    /* eslint-disable no-bitwise, no-param-reassign */
    const FLAGS = textsecure.protobuf.DataMessage.Flags;

    // Now that its decrypted, validate the message and clean it up for consumer
    //   processing
    // Note that messages may (generally) only perform one action and we ignore remaining
    //   fields after the first action.

    if (decrypted.flags == null) {
      decrypted.flags = 0;
    }
    if (decrypted.expireTimer == null) {
      decrypted.expireTimer = 0;
    }


    if (decrypted.flags & FLAGS.END_SESSION) {
      decrypted.body = null;
      decrypted.attachments = [];
      decrypted.group = null;
      return Promise.resolve(decrypted);
    } else if (decrypted.flags & FLAGS.EXPIRATION_TIMER_UPDATE) {
      decrypted.body = null;
      decrypted.attachments = [];
    } else if (decrypted.flags & FLAGS.PROFILE_KEY_UPDATE) {
      decrypted.body = null;
      decrypted.attachments = [];
    } else if (decrypted.flags !== 0) {
      throw new Error('Unknown flags in message');
    }

    const promises = [];

    if (decrypted.group !== null) {
      decrypted.group.id = decrypted.group.id.toBinary();

      if (decrypted.group.type === textsecure.protobuf.GroupContext.Type.UPDATE) {
        if (decrypted.group.avatar !== null) {
          promises.push(this.handleAttachment(decrypted.group.avatar));
        }
      }

      const storageGroups = textsecure.storage.groups;

      promises.push(storageGroups.getNumbers(decrypted.group.id).then((existingGroup) => {
        if (existingGroup === undefined) {
          if (decrypted.group.type !== textsecure.protobuf.GroupContext.Type.UPDATE) {
            decrypted.group.members = [source];
            console.log('Got message for unknown group');
          }
          return textsecure.storage.groups.createNewGroup(
            decrypted.group.members,
            decrypted.group.id
          );
        }
        const fromIndex = existingGroup.indexOf(source);

        if (fromIndex < 0) {
          // TODO: This could be indication of a race...
          console.log('Sender was not a member of the group they were sending from');
        }

        switch (decrypted.group.type) {
          case textsecure.protobuf.GroupContext.Type.UPDATE:
            decrypted.body = null;
            decrypted.attachments = [];
            return textsecure.storage.groups.updateNumbers(
              decrypted.group.id,
              decrypted.group.members
            );
          case textsecure.protobuf.GroupContext.Type.QUIT:
            decrypted.body = null;
            decrypted.attachments = [];
            if (source === this.number) {
              return textsecure.storage.groups.deleteGroup(decrypted.group.id);
            }
            return textsecure.storage.groups.removeNumber(decrypted.group.id, source);
          case textsecure.protobuf.GroupContext.Type.DELIVER:
            decrypted.group.name = null;
            decrypted.group.members = [];
            decrypted.group.avatar = null;
            return Promise.resolve();
          default:
            this.removeFromCache(envelope);
            throw new Error('Unknown group message type');
        }
      }));
    }

    for (let i = 0, max = decrypted.attachments.length; i < max; i += 1) {
      const attachment = decrypted.attachments[i];
      promises.push(this.handleAttachment(attachment));
    }

    if (decrypted.quote && decrypted.quote.id) {
      decrypted.quote.id = decrypted.quote.id.toNumber();
    }

    if (decrypted.quote && decrypted.quote.attachments) {
      const { attachments } = decrypted.quote;

      for (let i = 0, max = attachments.length; i < max; i += 1) {
        const attachment = attachments[i];
        if (attachment.thumbnail) {
          promises.push(this.handleAttachment(attachment.thumbnail));
        }
      }
    }

    return Promise.all(promises).then(() => decrypted);
    /* eslint-enable no-bitwise, no-param-reassign */
  },
});

window.textsecure = window.textsecure || {};

textsecure.MessageReceiver = function MessageReceiverWrapper(
  url,
  username,
  password,
  signalingKey,
  options
) {
  const messageReceiver = new MessageReceiver(
    url,
    username,
    password,
    signalingKey,
    options
  );
  this.addEventListener = messageReceiver.addEventListener.bind(messageReceiver);
  this.removeEventListener = messageReceiver.removeEventListener.bind(messageReceiver);
  this.getStatus = messageReceiver.getStatus.bind(messageReceiver);
  this.close = messageReceiver.close.bind(messageReceiver);
  messageReceiver.connect();

  textsecure.replay.registerFunction(
    messageReceiver.tryMessageAgain.bind(messageReceiver),
    textsecure.replay.Type.INIT_SESSION
  );
};

textsecure.MessageReceiver.prototype = {
  constructor: textsecure.MessageReceiver,
};

