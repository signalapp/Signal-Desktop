/* global textsecure, WebAPI, libsignal, OutgoingMessage, window */

/* eslint-disable more/no-then, no-bitwise */

function stringToArrayBuffer(str) {
  if (typeof str !== 'string') {
    throw new Error('Passed non-string to stringToArrayBuffer');
  }
  const res = new ArrayBuffer(str.length);
  const uint = new Uint8Array(res);
  for (let i = 0; i < str.length; i += 1) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

function Message(options) {
  this.body = options.body;
  this.attachments = options.attachments || [];
  this.quote = options.quote;
  this.group = options.group;
  this.flags = options.flags;
  this.recipients = options.recipients;
  this.timestamp = options.timestamp;
  this.needsSync = options.needsSync;
  this.expireTimer = options.expireTimer;
  this.profileKey = options.profileKey;

  if (!(this.recipients instanceof Array) || this.recipients.length < 1) {
    throw new Error('Invalid recipient list');
  }

  if (!this.group && this.recipients.length > 1) {
    throw new Error('Invalid recipient list for non-group');
  }

  if (typeof this.timestamp !== 'number') {
    throw new Error('Invalid timestamp');
  }

  if (this.expireTimer !== undefined && this.expireTimer !== null) {
    if (typeof this.expireTimer !== 'number' || !(this.expireTimer >= 0)) {
      throw new Error('Invalid expireTimer');
    }
  }

  if (this.attachments) {
    if (!(this.attachments instanceof Array)) {
      throw new Error('Invalid message attachments');
    }
  }
  if (this.flags !== undefined) {
    if (typeof this.flags !== 'number') {
      throw new Error('Invalid message flags');
    }
  }
  if (this.isEndSession()) {
    if (
      this.body !== null ||
      this.group !== null ||
      this.attachments.length !== 0
    ) {
      throw new Error('Invalid end session message');
    }
  } else {
    if (
      typeof this.timestamp !== 'number' ||
      (this.body && typeof this.body !== 'string')
    ) {
      throw new Error('Invalid message body');
    }
    if (this.group) {
      if (
        typeof this.group.id !== 'string' ||
        typeof this.group.type !== 'number'
      ) {
        throw new Error('Invalid group context');
      }
    }
  }
}

Message.prototype = {
  constructor: Message,
  isEndSession() {
    return this.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION;
  },
  toProto() {
    if (this.dataMessage instanceof textsecure.protobuf.DataMessage) {
      return this.dataMessage;
    }
    const proto = new textsecure.protobuf.DataMessage();
    if (this.body) {
      proto.body = this.body;
    }
    proto.attachments = this.attachmentPointers;
    if (this.flags) {
      proto.flags = this.flags;
    }
    if (this.group) {
      proto.group = new textsecure.protobuf.GroupContext();
      proto.group.id = stringToArrayBuffer(this.group.id);
      proto.group.type = this.group.type;
    }
    if (this.quote) {
      const { QuotedAttachment } = textsecure.protobuf.DataMessage.Quote;
      const { Quote } = textsecure.protobuf.DataMessage;

      proto.quote = new Quote();
      const { quote } = proto;

      quote.id = this.quote.id;
      quote.author = this.quote.author;
      quote.text = this.quote.text;
      quote.attachments = (this.quote.attachments || []).map(attachment => {
        const quotedAttachment = new QuotedAttachment();

        quotedAttachment.contentType = attachment.contentType;
        quotedAttachment.fileName = attachment.fileName;
        if (attachment.attachmentPointer) {
          quotedAttachment.thumbnail = attachment.attachmentPointer;
        }

        return quotedAttachment;
      });
    }
    if (this.expireTimer) {
      proto.expireTimer = this.expireTimer;
    }

    if (this.profileKey) {
      proto.profileKey = this.profileKey;
    }

    this.dataMessage = proto;
    return proto;
  },
  toArrayBuffer() {
    return this.toProto().toArrayBuffer();
  },
};

function MessageSender(username, password) {
  this.server = WebAPI.connect({ username, password });
  this.pendingMessages = {};
}

MessageSender.prototype = {
  constructor: MessageSender,

  //  makeAttachmentPointer :: Attachment -> Promise AttachmentPointerProto
  makeAttachmentPointer(attachment) {
    if (typeof attachment !== 'object' || attachment == null) {
      return Promise.resolve(undefined);
    }

    if (
      !(attachment.data instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(attachment.data)
    ) {
      return Promise.reject(
        new TypeError(
          `\`attachment.data\` must be an \`ArrayBuffer\` or \`ArrayBufferView\`; got: ${typeof attachment.data}`
        )
      );
    }

    const proto = new textsecure.protobuf.AttachmentPointer();
    proto.key = libsignal.crypto.getRandomBytes(64);

    const iv = libsignal.crypto.getRandomBytes(16);
    return textsecure.crypto
      .encryptAttachment(attachment.data, proto.key, iv)
      .then(result =>
        this.server.putAttachment(result.ciphertext).then(id => {
          proto.id = id;
          proto.contentType = attachment.contentType;
          proto.digest = result.digest;
          if (attachment.fileName) {
            proto.fileName = attachment.fileName;
          }
          if (attachment.size) {
            proto.size = attachment.size;
          }
          if (attachment.flags) {
            proto.flags = attachment.flags;
          }
          return proto;
        })
      );
  },

  queueJobForNumber(number, runJob) {
    const taskWithTimeout = textsecure.createTaskWithTimeout(
      runJob,
      `queueJobForNumber ${number}`
    );

    const runPrevious = this.pendingMessages[number] || Promise.resolve();
    this.pendingMessages[number] = runPrevious.then(
      taskWithTimeout,
      taskWithTimeout
    );

    const runCurrent = this.pendingMessages[number];
    runCurrent.then(() => {
      if (this.pendingMessages[number] === runCurrent) {
        delete this.pendingMessages[number];
      }
    });
  },

  uploadAttachments(message) {
    return Promise.all(
      message.attachments.map(this.makeAttachmentPointer.bind(this))
    )
      .then(attachmentPointers => {
        // eslint-disable-next-line no-param-reassign
        message.attachmentPointers = attachmentPointers;
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'HTTPError') {
          throw new textsecure.MessageError(message, error);
        } else {
          throw error;
        }
      });
  },

  uploadThumbnails(message) {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { quote } = message;

    if (!quote || !quote.attachments || quote.attachments.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(
      quote.attachments.map(attachment => {
        const { thumbnail } = attachment;
        if (!thumbnail) {
          return null;
        }

        return makePointer(thumbnail).then(pointer => {
          // eslint-disable-next-line no-param-reassign
          attachment.attachmentPointer = pointer;
        });
      })
    ).catch(error => {
      if (error instanceof Error && error.name === 'HTTPError') {
        throw new textsecure.MessageError(message, error);
      } else {
        throw error;
      }
    });
  },

  sendMessage(attrs, options) {
    const message = new Message(attrs);
    const silent = false;

    return Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message),
    ]).then(
      () =>
        new Promise((resolve, reject) => {
          this.sendMessageProto(
            message.timestamp,
            message.recipients,
            message.toProto(),
            res => {
              res.dataMessage = message.toArrayBuffer();
              if (res.errors.length > 0) {
                reject(res);
              } else {
                resolve(res);
              }
            },
            silent,
            options
          );
        })
    );
  },
  sendMessageProto(
    timestamp,
    numbers,
    message,
    callback,
    silent,
    options = {}
  ) {
    const rejections = textsecure.storage.get('signedKeyRotationRejected', 0);
    if (rejections > 5) {
      throw new textsecure.SignedPreKeyRotationError(
        numbers,
        message.toArrayBuffer(),
        timestamp
      );
    }

    const outgoing = new OutgoingMessage(
      this.server,
      timestamp,
      numbers,
      message,
      silent,
      callback,
      options
    );

    numbers.forEach(number => {
      this.queueJobForNumber(number, () => outgoing.sendToNumber(number));
    });
  },

  sendIndividualProto(number, proto, timestamp, silent, options = {}) {
    return new Promise((resolve, reject) => {
      const callback = res => {
        if (res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };
      this.sendMessageProto(
        timestamp,
        [number],
        proto,
        callback,
        silent,
        options
      );
    });
  },

  createSyncMessage() {
    const syncMessage = new textsecure.protobuf.SyncMessage();

    // Generate a random int from 1 and 512
    const buffer = libsignal.crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    syncMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

    return syncMessage;
  },

  sendSyncMessage(
    encodedDataMessage,
    timestamp,
    destination,
    expirationStartTimestamp,
    sentTo = [],
    unidentifiedDeliveries = [],
    options
  ) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice === 1 || myDevice === '1') {
      return Promise.resolve();
    }

    const dataMessage = textsecure.protobuf.DataMessage.decode(
      encodedDataMessage
    );
    const sentMessage = new textsecure.protobuf.SyncMessage.Sent();
    sentMessage.timestamp = timestamp;
    sentMessage.message = dataMessage;
    if (destination) {
      sentMessage.destination = destination;
    }
    if (expirationStartTimestamp) {
      sentMessage.expirationStartTimestamp = expirationStartTimestamp;
    }

    const unidentifiedLookup = unidentifiedDeliveries.reduce(
      (accumulator, item) => {
        // eslint-disable-next-line no-param-reassign
        accumulator[item] = true;
        return accumulator;
      },
      Object.create(null)
    );

    // Though this field has 'unidenified' in the name, it should have entries for each
    //   number we sent to.
    if (sentTo && sentTo.length) {
      sentMessage.unidentifiedStatus = sentTo.map(number => {
        const status = new textsecure.protobuf.SyncMessage.Sent.UnidentifiedDeliveryStatus();
        status.destination = number;
        status.unidentified = Boolean(unidentifiedLookup[number]);
        return status;
      });
    }

    const syncMessage = this.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },

  async getProfile(number, { accessKey } = {}) {
    if (accessKey) {
      return this.server.getProfileUnauth(number, { accessKey });
    }

    return this.server.getProfile(number);
  },

  getAvatar(path) {
    return this.server.getAvatar(path);
  },

  sendRequestConfigurationSyncMessage(options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const request = new textsecure.protobuf.SyncMessage.Request();
      request.type = textsecure.protobuf.SyncMessage.Request.Type.CONFIGURATION;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  },
  sendRequestGroupSyncMessage(options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const request = new textsecure.protobuf.SyncMessage.Request();
      request.type = textsecure.protobuf.SyncMessage.Request.Type.GROUPS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  },

  sendRequestContactSyncMessage(options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const request = new textsecure.protobuf.SyncMessage.Request();
      request.type = textsecure.protobuf.SyncMessage.Request.Type.CONTACTS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  },
  sendDeliveryReceipt(recipientId, timestamp, options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myNumber === recipientId && (myDevice === 1 || myDevice === '1')) {
      return Promise.resolve();
    }

    const receiptMessage = new textsecure.protobuf.ReceiptMessage();
    receiptMessage.type = textsecure.protobuf.ReceiptMessage.Type.DELIVERY;
    receiptMessage.timestamp = [timestamp];

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      recipientId,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },
  sendReadReceipts(sender, timestamps, options) {
    const receiptMessage = new textsecure.protobuf.ReceiptMessage();
    receiptMessage.type = textsecure.protobuf.ReceiptMessage.Type.READ;
    receiptMessage.timestamp = timestamps;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      sender,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },
  syncReadMessages(reads, options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const syncMessage = this.createSyncMessage();
      syncMessage.read = [];
      for (let i = 0; i < reads.length; i += 1) {
        const read = new textsecure.protobuf.SyncMessage.Read();
        read.timestamp = reads[i].timestamp;
        read.sender = reads[i].sender;
        syncMessage.read.push(read);
      }
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  },
  syncVerification(destination, state, identityKey, options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    const now = Date.now();

    if (myDevice === 1 || myDevice === '1') {
      return Promise.resolve();
    }

    // First send a null message to mask the sync message.
    const nullMessage = new textsecure.protobuf.NullMessage();

    // Generate a random int from 1 and 512
    const buffer = libsignal.crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    nullMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.nullMessage = nullMessage;

    // We want the NullMessage to look like a normal outgoing message; not silent
    const silent = false;
    const promise = this.sendIndividualProto(
      destination,
      contentMessage,
      now,
      silent,
      options
    );

    return promise.then(() => {
      const verified = new textsecure.protobuf.Verified();
      verified.state = state;
      verified.destination = destination;
      verified.identityKey = identityKey;
      verified.nullMessage = nullMessage.padding;

      const syncMessage = this.createSyncMessage();
      syncMessage.verified = verified;

      const secondMessage = new textsecure.protobuf.Content();
      secondMessage.syncMessage = syncMessage;

      const innerSilent = true;
      return this.sendIndividualProto(
        myNumber,
        secondMessage,
        now,
        innerSilent,
        options
      );
    });
  },

  sendGroupProto(providedNumbers, proto, timestamp = Date.now(), options = {}) {
    const me = textsecure.storage.user.getNumber();
    const numbers = providedNumbers.filter(number => number !== me);
    if (numbers.length === 0) {
      return Promise.reject(new Error('No other members in the group'));
    }

    return new Promise((resolve, reject) => {
      const silent = true;
      const callback = res => {
        res.dataMessage = proto.toArrayBuffer();
        if (res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };

      this.sendMessageProto(
        timestamp,
        numbers,
        proto,
        callback,
        silent,
        options
      );
    });
  },

  sendMessageToNumber(
    number,
    messageText,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    options
  ) {
    return this.sendMessage(
      {
        recipients: [number],
        body: messageText,
        timestamp,
        attachments,
        quote,
        needsSync: true,
        expireTimer,
        profileKey,
      },
      options
    );
  },

  resetSession(number, timestamp, options) {
    window.log.info('resetting secure session');
    const silent = false;
    const proto = new textsecure.protobuf.DataMessage();
    proto.body = 'TERMINATE';
    proto.flags = textsecure.protobuf.DataMessage.Flags.END_SESSION;

    const logError = prefix => error => {
      window.log.error(prefix, error && error.stack ? error.stack : error);
      throw error;
    };
    const deleteAllSessions = targetNumber =>
      textsecure.storage.protocol.getDeviceIds(targetNumber).then(deviceIds =>
        Promise.all(
          deviceIds.map(deviceId => {
            const address = new libsignal.SignalProtocolAddress(
              targetNumber,
              deviceId
            );
            window.log.info('deleting sessions for', address.toString());
            const sessionCipher = new libsignal.SessionCipher(
              textsecure.storage.protocol,
              address
            );
            return sessionCipher.deleteAllSessionsForDevice();
          })
        )
      );

    const sendToContact = deleteAllSessions(number)
      .catch(logError('resetSession/deleteAllSessions1 error:'))
      .then(() => {
        window.log.info(
          'finished closing local sessions, now sending to contact'
        );
        return this.sendIndividualProto(
          number,
          proto,
          timestamp,
          silent,
          options
        ).catch(logError('resetSession/sendToContact error:'));
      })
      .then(() =>
        deleteAllSessions(number).catch(
          logError('resetSession/deleteAllSessions2 error:')
        )
      );

    const buffer = proto.toArrayBuffer();
    const sendSync = this.sendSyncMessage(
      buffer,
      timestamp,
      number,
      null,
      [],
      [],
      options
    ).catch(logError('resetSession/sendSync error:'));

    return Promise.all([sendToContact, sendSync]);
  },

  sendMessageToGroup(
    groupId,
    messageText,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    options
  ) {
    return textsecure.storage.groups.getNumbers(groupId).then(targetNumbers => {
      if (targetNumbers === undefined) {
        return Promise.reject(new Error('Unknown Group'));
      }

      const me = textsecure.storage.user.getNumber();
      const numbers = targetNumbers.filter(number => number !== me);
      if (numbers.length === 0) {
        return Promise.reject(new Error('No other members in the group'));
      }

      return this.sendMessage(
        {
          recipients: numbers,
          body: messageText,
          timestamp,
          attachments,
          quote,
          needsSync: true,
          expireTimer,
          profileKey,
          group: {
            id: groupId,
            type: textsecure.protobuf.GroupContext.Type.DELIVER,
          },
        },
        options
      );
    });
  },

  createGroup(targetNumbers, name, avatar, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();

    return textsecure.storage.groups
      .createNewGroup(targetNumbers)
      .then(group => {
        proto.group.id = stringToArrayBuffer(group.id);
        const { numbers } = group;

        proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
        proto.group.members = numbers;
        proto.group.name = name;

        return this.makeAttachmentPointer(avatar).then(attachment => {
          proto.group.avatar = attachment;
          return this.sendGroupProto(numbers, proto, Date.now(), options).then(
            () => proto.group.id
          );
        });
      });
  },

  updateGroup(groupId, name, avatar, targetNumbers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();

    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;

    return textsecure.storage.groups
      .addNumbers(groupId, targetNumbers)
      .then(numbers => {
        if (numbers === undefined) {
          return Promise.reject(new Error('Unknown Group'));
        }
        proto.group.members = numbers;

        return this.makeAttachmentPointer(avatar).then(attachment => {
          proto.group.avatar = attachment;
          return this.sendGroupProto(numbers, proto, Date.now(), options).then(
            () => proto.group.id
          );
        });
      });
  },

  addNumberToGroup(groupId, number, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;

    return textsecure.storage.groups
      .addNumbers(groupId, [number])
      .then(numbers => {
        if (numbers === undefined)
          return Promise.reject(new Error('Unknown Group'));
        proto.group.members = numbers;

        return this.sendGroupProto(numbers, proto, Date.now(), options);
      });
  },

  setGroupName(groupId, name, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;

    return textsecure.storage.groups.getNumbers(groupId).then(numbers => {
      if (numbers === undefined)
        return Promise.reject(new Error('Unknown Group'));
      proto.group.members = numbers;

      return this.sendGroupProto(numbers, proto, Date.now(), options);
    });
  },

  setGroupAvatar(groupId, avatar, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;

    return textsecure.storage.groups.getNumbers(groupId).then(numbers => {
      if (numbers === undefined)
        return Promise.reject(new Error('Unknown Group'));
      proto.group.members = numbers;

      return this.makeAttachmentPointer(avatar).then(attachment => {
        proto.group.avatar = attachment;
        return this.sendGroupProto(numbers, proto, Date.now(), options);
      });
    });
  },

  leaveGroup(groupId, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.QUIT;

    return textsecure.storage.groups.getNumbers(groupId).then(numbers => {
      if (numbers === undefined)
        return Promise.reject(new Error('Unknown Group'));
      return textsecure.storage.groups
        .deleteGroup(groupId)
        .then(() => this.sendGroupProto(numbers, proto, Date.now(), options));
    });
  },
  sendExpirationTimerUpdateToGroup(
    groupId,
    expireTimer,
    timestamp,
    profileKey,
    options
  ) {
    return textsecure.storage.groups.getNumbers(groupId).then(targetNumbers => {
      if (targetNumbers === undefined)
        return Promise.reject(new Error('Unknown Group'));

      const me = textsecure.storage.user.getNumber();
      const numbers = targetNumbers.filter(number => number !== me);
      if (numbers.length === 0) {
        return Promise.reject(new Error('No other members in the group'));
      }
      return this.sendMessage(
        {
          recipients: numbers,
          timestamp,
          needsSync: true,
          expireTimer,
          profileKey,
          flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
          group: {
            id: groupId,
            type: textsecure.protobuf.GroupContext.Type.DELIVER,
          },
        },
        options
      );
    });
  },
  sendExpirationTimerUpdateToNumber(
    number,
    expireTimer,
    timestamp,
    profileKey,
    options
  ) {
    return this.sendMessage(
      {
        recipients: [number],
        timestamp,
        needsSync: true,
        expireTimer,
        profileKey,
        flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      },
      options
    );
  },
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function MessageSenderWrapper(
  url,
  username,
  password,
  cdnUrl
) {
  const sender = new MessageSender(url, username, password, cdnUrl);

  this.sendExpirationTimerUpdateToNumber = sender.sendExpirationTimerUpdateToNumber.bind(
    sender
  );
  this.sendExpirationTimerUpdateToGroup = sender.sendExpirationTimerUpdateToGroup.bind(
    sender
  );
  this.sendRequestGroupSyncMessage = sender.sendRequestGroupSyncMessage.bind(
    sender
  );
  this.sendRequestContactSyncMessage = sender.sendRequestContactSyncMessage.bind(
    sender
  );
  this.sendRequestConfigurationSyncMessage = sender.sendRequestConfigurationSyncMessage.bind(
    sender
  );
  this.sendMessageToNumber = sender.sendMessageToNumber.bind(sender);
  this.sendMessage = sender.sendMessage.bind(sender);
  this.resetSession = sender.resetSession.bind(sender);
  this.sendMessageToGroup = sender.sendMessageToGroup.bind(sender);
  this.createGroup = sender.createGroup.bind(sender);
  this.updateGroup = sender.updateGroup.bind(sender);
  this.addNumberToGroup = sender.addNumberToGroup.bind(sender);
  this.setGroupName = sender.setGroupName.bind(sender);
  this.setGroupAvatar = sender.setGroupAvatar.bind(sender);
  this.leaveGroup = sender.leaveGroup.bind(sender);
  this.sendSyncMessage = sender.sendSyncMessage.bind(sender);
  this.getProfile = sender.getProfile.bind(sender);
  this.getAvatar = sender.getAvatar.bind(sender);
  this.syncReadMessages = sender.syncReadMessages.bind(sender);
  this.syncVerification = sender.syncVerification.bind(sender);
  this.sendDeliveryReceipt = sender.sendDeliveryReceipt.bind(sender);
  this.sendReadReceipts = sender.sendReadReceipts.bind(sender);
};

textsecure.MessageSender.prototype = {
  constructor: textsecure.MessageSender,
};
