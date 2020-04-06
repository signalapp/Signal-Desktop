// eslint-disable-next-line max-len
/* global _, textsecure, WebAPI, libsignal, OutgoingMessage, window, dcodeIO, ConversationController */

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
function hexStringToArrayBuffer(string) {
  return dcodeIO.ByteBuffer.wrap(string, 'hex').toArrayBuffer();
}
function base64ToArrayBuffer(string) {
  return dcodeIO.ByteBuffer.wrap(string, 'base64').toArrayBuffer();
}

function Message(options) {
  this.attachments = options.attachments || [];
  this.body = options.body;
  this.expireTimer = options.expireTimer;
  this.flags = options.flags;
  this.group = options.group;
  this.needsSync = options.needsSync;
  this.preview = options.preview;
  this.profileKey = options.profileKey;
  this.quote = options.quote;
  this.recipients = options.recipients;
  this.sticker = options.sticker;
  this.reaction = options.reaction;
  this.timestamp = options.timestamp;

  if (!(this.recipients instanceof Array)) {
    throw new Error('Invalid recipient list');
  }

  if (!this.group && this.recipients.length !== 1) {
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

    proto.timestamp = this.timestamp;
    proto.attachments = this.attachmentPointers;

    if (this.body) {
      proto.body = this.body;
    }
    if (this.flags) {
      proto.flags = this.flags;
    }
    if (this.group) {
      proto.group = new textsecure.protobuf.GroupContext();
      proto.group.id = stringToArrayBuffer(this.group.id);
      proto.group.type = this.group.type;
    }
    if (this.sticker) {
      proto.sticker = new textsecure.protobuf.DataMessage.Sticker();
      proto.sticker.packId = hexStringToArrayBuffer(this.sticker.packId);
      proto.sticker.packKey = base64ToArrayBuffer(this.sticker.packKey);
      proto.sticker.stickerId = this.sticker.stickerId;

      if (this.sticker.attachmentPointer) {
        proto.sticker.data = this.sticker.attachmentPointer;
      }
    }
    if (this.reaction) {
      proto.reaction = this.reaction;
    }
    if (Array.isArray(this.preview)) {
      proto.preview = this.preview.map(preview => {
        const item = new textsecure.protobuf.DataMessage.Preview();
        item.title = preview.title;
        item.url = preview.url;
        item.image = preview.image || null;
        return item;
      });
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

  _getAttachmentSizeBucket(size) {
    return Math.max(
      541,
      Math.floor(1.05 ** Math.ceil(Math.log(size) / Math.log(1.05)))
    );
  },

  getPaddedAttachment(data) {
    const size = data.byteLength;
    const paddedSize = this._getAttachmentSizeBucket(size);
    const padding = window.Signal.Crypto.getZeroes(paddedSize - size);

    return window.Signal.Crypto.concatenateBytes(data, padding);
  },

  async makeAttachmentPointer(attachment) {
    if (typeof attachment !== 'object' || attachment == null) {
      return Promise.resolve(undefined);
    }

    const { data, size } = attachment;
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      throw new Error(
        `makeAttachmentPointer: data was a '${typeof data}' instead of ArrayBuffer/ArrayBufferView`
      );
    }
    if (data.byteLength !== size) {
      throw new Error(
        `makeAttachmentPointer: Size ${size} did not match data.byteLength ${data.byteLength}`
      );
    }

    const padded = this.getPaddedAttachment(data);
    const key = libsignal.crypto.getRandomBytes(64);
    const iv = libsignal.crypto.getRandomBytes(16);

    const result = await textsecure.crypto.encryptAttachment(padded, key, iv);
    const id = await this.server.putAttachment(result.ciphertext);

    const proto = new textsecure.protobuf.AttachmentPointer();
    proto.id = id;
    proto.contentType = attachment.contentType;
    proto.key = key;
    proto.size = attachment.size;
    proto.digest = result.digest;

    if (attachment.fileName) {
      proto.fileName = attachment.fileName;
    }
    if (attachment.flags) {
      proto.flags = attachment.flags;
    }
    if (attachment.width) {
      proto.width = attachment.width;
    }
    if (attachment.height) {
      proto.height = attachment.height;
    }
    if (attachment.caption) {
      proto.caption = attachment.caption;
    }

    return proto;
  },

  async queueJobForIdentifier(identifier, runJob) {
    const { id } = await ConversationController.getOrCreateAndWait(
      identifier,
      'private'
    );
    this.pendingMessages[id] =
      this.pendingMessages[id] || new window.PQueue({ concurrency: 1 });

    const queue = this.pendingMessages[id];

    const taskWithTimeout = textsecure.createTaskWithTimeout(
      runJob,
      `queueJobForIdentifier ${identifier} ${id}`
    );

    return queue.add(taskWithTimeout);
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

  async uploadLinkPreviews(message) {
    try {
      const preview = await Promise.all(
        (message.preview || []).map(async item => ({
          ...item,
          image: await this.makeAttachmentPointer(item.image),
        }))
      );
      // eslint-disable-next-line no-param-reassign
      message.preview = preview;
    } catch (error) {
      if (error instanceof Error && error.name === 'HTTPError') {
        throw new textsecure.MessageError(message, error);
      } else {
        throw error;
      }
    }
  },

  async uploadSticker(message) {
    try {
      const { sticker } = message;

      if (!sticker || !sticker.data) {
        return;
      }

      // eslint-disable-next-line no-param-reassign
      message.sticker = {
        ...sticker,
        attachmentPointer: await this.makeAttachmentPointer(sticker.data),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'HTTPError') {
        throw new textsecure.MessageError(message, error);
      } else {
        throw error;
      }
    }
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
      this.uploadLinkPreviews(message),
      this.uploadSticker(message),
    ]).then(
      () =>
        new Promise((resolve, reject) => {
          this.sendMessageProto(
            message.timestamp,
            message.recipients || [],
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
    recipients,
    messageProto,
    callback,
    silent,
    options = {}
  ) {
    const rejections = textsecure.storage.get('signedKeyRotationRejected', 0);
    if (rejections > 5) {
      throw new textsecure.SignedPreKeyRotationError(
        recipients,
        messageProto.toArrayBuffer(),
        timestamp
      );
    }

    const outgoing = new OutgoingMessage(
      this.server,
      timestamp,
      recipients,
      messageProto,
      silent,
      callback,
      options
    );

    recipients.forEach(identifier => {
      this.queueJobForIdentifier(identifier, () =>
        outgoing.sendToIdentifier(identifier)
      );
    });
  },

  sendMessageProtoAndWait(
    timestamp,
    identifiers,
    messageProto,
    silent,
    options = {}
  ) {
    return new Promise((resolve, reject) => {
      const callback = result => {
        if (result && result.errors && result.errors.length > 0) {
          return reject(result);
        }

        return resolve(result);
      };

      this.sendMessageProto(
        timestamp,
        identifiers,
        messageProto,
        callback,
        silent,
        options
      );
    });
  },

  sendIndividualProto(identifier, proto, timestamp, silent, options = {}) {
    return new Promise((resolve, reject) => {
      const callback = res => {
        if (res && res.errors && res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };
      this.sendMessageProto(
        timestamp,
        [identifier],
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
    destinationUuid,
    expirationStartTimestamp,
    sentTo = [],
    unidentifiedDeliveries = [],
    isUpdate = false,
    options
  ) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
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
    if (destinationUuid) {
      sentMessage.destinationUuid = destinationUuid;
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

    if (isUpdate) {
      sentMessage.isRecipientUpdate = true;
    }

    // Though this field has 'unidenified' in the name, it should have entries for each
    //   number we sent to.
    if (sentTo && sentTo.length) {
      sentMessage.unidentifiedStatus = sentTo.map(identifier => {
        const status = new textsecure.protobuf.SyncMessage.Sent.UnidentifiedDeliveryStatus();
        const conv = ConversationController.get(identifier);
        if (conv && conv.get('e164')) {
          status.destination = conv.get('e164');
        }
        if (conv && conv.get('uuid')) {
          status.destinationUuid = conv.get('uuid');
        }
        status.unidentified = Boolean(unidentifiedLookup[identifier]);
        return status;
      });
    }

    const syncMessage = this.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myUuid || myNumber,
      contentMessage,
      timestamp,
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

  getSticker(packId, stickerId) {
    return this.server.getSticker(packId, stickerId);
  },
  getStickerPackManifest(packId) {
    return this.server.getStickerPackManifest(packId);
  },

  sendRequestBlockSyncMessage(options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const request = new textsecure.protobuf.SyncMessage.Request();
      request.type = textsecure.protobuf.SyncMessage.Request.Type.BLOCKED;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myUuid || myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  },

  sendRequestConfigurationSyncMessage(options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
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
        myUuid || myNumber,
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
    const myUuid = textsecure.storage.user.getUuid();
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
        myUuid || myNumber,
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
    const myUuid = textsecure.storage.user.getUuid();

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
        myUuid || myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  },

  async sendTypingMessage(options = {}, sendOptions = {}) {
    const ACTION_ENUM = textsecure.protobuf.TypingMessage.Action;
    const { recipientId, groupId, groupNumbers, isTyping, timestamp } = options;

    // We don't want to send typing messages to our other devices, but we will
    //   in the group case.
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    if (recipientId && (myNumber === recipientId || myUuid === recipientId)) {
      return null;
    }

    if (!recipientId && !groupId) {
      throw new Error('Need to provide either recipientId or groupId!');
    }

    const recipients = groupId
      ? _.without(groupNumbers, myNumber, myUuid)
      : [recipientId];
    const groupIdBuffer = groupId
      ? window.Signal.Crypto.fromEncodedBinaryToArrayBuffer(groupId)
      : null;

    const action = isTyping ? ACTION_ENUM.STARTED : ACTION_ENUM.STOPPED;
    const finalTimestamp = timestamp || Date.now();

    const typingMessage = new textsecure.protobuf.TypingMessage();
    typingMessage.groupId = groupIdBuffer;
    typingMessage.action = action;
    typingMessage.timestamp = finalTimestamp;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.typingMessage = typingMessage;

    const silent = true;
    const online = true;

    return this.sendMessageProtoAndWait(
      finalTimestamp,
      recipients,
      contentMessage,
      silent,
      {
        ...sendOptions,
        online,
      }
    );
  },

  sendDeliveryReceipt(recipientE164, recipientUuid, timestamps, options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (
      (myNumber === recipientE164 || myUuid === recipientUuid) &&
      (myDevice === 1 || myDevice === '1')
    ) {
      return Promise.resolve();
    }

    const receiptMessage = new textsecure.protobuf.ReceiptMessage();
    receiptMessage.type = textsecure.protobuf.ReceiptMessage.Type.DELIVERY;
    receiptMessage.timestamp = timestamps;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      recipientUuid || recipientE164,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },

  sendReadReceipts(senderE164, senderUuid, timestamps, options) {
    const receiptMessage = new textsecure.protobuf.ReceiptMessage();
    receiptMessage.type = textsecure.protobuf.ReceiptMessage.Type.READ;
    receiptMessage.timestamp = timestamps;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      senderUuid || senderE164,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },
  syncReadMessages(reads, options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
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
        myUuid || myNumber,
        contentMessage,
        Date.now(),
        silent,
        options
      );
    }

    return Promise.resolve();
  },

  async syncViewOnceOpen(sender, senderUuid, timestamp, options) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice === 1 || myDevice === '1') {
      return null;
    }

    const syncMessage = this.createSyncMessage();

    const viewOnceOpen = new textsecure.protobuf.SyncMessage.ViewOnceOpen();
    viewOnceOpen.sender = sender;
    viewOnceOpen.senderUuid = senderUuid;
    viewOnceOpen.timestamp = timestamp;
    syncMessage.viewOnceOpen = viewOnceOpen;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myUuid || myNumber,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },

  async sendStickerPackSync(operations, options) {
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice === 1 || myDevice === '1') {
      return null;
    }

    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    const ENUM = textsecure.protobuf.SyncMessage.StickerPackOperation.Type;

    const packOperations = operations.map(item => {
      const { packId, packKey, installed } = item;

      const operation = new textsecure.protobuf.SyncMessage.StickerPackOperation();
      operation.packId = hexStringToArrayBuffer(packId);
      operation.packKey = base64ToArrayBuffer(packKey);
      operation.type = installed ? ENUM.INSTALL : ENUM.REMOVE;

      return operation;
    });

    const syncMessage = this.createSyncMessage();
    syncMessage.stickerPackOperation = packOperations;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myUuid || myNumber,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },

  syncVerification(
    destinationE164,
    destinationUuid,
    state,
    identityKey,
    options
  ) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
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
      destinationUuid || destinationE164,
      contentMessage,
      now,
      silent,
      options
    );

    return promise.then(() => {
      const verified = new textsecure.protobuf.Verified();
      verified.state = state;
      if (destinationE164) {
        verified.destination = destinationE164;
      }
      if (destinationUuid) {
        verified.destinationUuid = destinationUuid;
      }
      verified.identityKey = identityKey;
      verified.nullMessage = nullMessage.padding;

      const syncMessage = this.createSyncMessage();
      syncMessage.verified = verified;

      const secondMessage = new textsecure.protobuf.Content();
      secondMessage.syncMessage = syncMessage;

      const innerSilent = true;
      return this.sendIndividualProto(
        myUuid || myNumber,
        secondMessage,
        now,
        innerSilent,
        options
      );
    });
  },

  sendGroupProto(
    providedIdentifiers,
    proto,
    timestamp = Date.now(),
    options = {}
  ) {
    const myE164 = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    const identifiers = providedIdentifiers.filter(
      id => id !== myE164 && id !== myUuid
    );

    if (identifiers.length === 0) {
      return Promise.resolve({
        successfulIdentifiers: [],
        failoverIdentifiers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: proto.toArrayBuffer(),
      });
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
        providedIdentifiers,
        proto,
        callback,
        silent,
        options
      );
    });
  },

  async getMessageProto(
    destination,
    body,
    attachments,
    quote,
    preview,
    sticker,
    reaction,
    timestamp,
    expireTimer,
    profileKey,
    flags
  ) {
    const attributes = {
      recipients: [destination],
      destination,
      body,
      timestamp,
      attachments,
      quote,
      preview,
      sticker,
      reaction,
      expireTimer,
      profileKey,
      flags,
    };

    return this.getMessageProtoObj(attributes);
  },

  async getMessageProtoObj(attributes) {
    const message = new Message(attributes);
    await Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message),
      this.uploadLinkPreviews(message),
      this.uploadSticker(message),
    ]);

    return message.toArrayBuffer();
  },

  sendMessageToIdentifier(
    identifier,
    messageText,
    attachments,
    quote,
    preview,
    sticker,
    reaction,
    timestamp,
    expireTimer,
    profileKey,
    options
  ) {
    return this.sendMessage(
      {
        recipients: [identifier],
        body: messageText,
        timestamp,
        attachments,
        quote,
        preview,
        sticker,
        reaction,
        expireTimer,
        profileKey,
      },
      options
    );
  },

  resetSession(identifier, timestamp, options) {
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

    const sendToContactPromise = deleteAllSessions(identifier)
      .catch(logError('resetSession/deleteAllSessions1 error:'))
      .then(() => {
        window.log.info(
          'finished closing local sessions, now sending to contact'
        );
        return this.sendIndividualProto(
          identifier,
          proto,
          timestamp,
          silent,
          options
        ).catch(logError('resetSession/sendToContact error:'));
      })
      .then(() =>
        deleteAllSessions(identifier).catch(
          logError('resetSession/deleteAllSessions2 error:')
        )
      );

    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    // We already sent the reset session to our other devices in the code above!
    if (identifier === myNumber || identifier === myUuid) {
      return sendToContactPromise;
    }

    const buffer = proto.toArrayBuffer();
    const sendSyncPromise = this.sendSyncMessage(
      buffer,
      timestamp,
      identifier,
      null,
      [],
      [],
      options
    ).catch(logError('resetSession/sendSync error:'));

    return Promise.all([sendToContactPromise, sendSyncPromise]);
  },

  async sendMessageToGroup(
    groupId,
    recipients,
    messageText,
    attachments,
    quote,
    preview,
    sticker,
    reaction,
    timestamp,
    expireTimer,
    profileKey,
    options
  ) {
    const myE164 = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getNumber();
    const attrs = {
      recipients: recipients.filter(r => r !== myE164 && r !== myUuid),
      body: messageText,
      timestamp,
      attachments,
      quote,
      preview,
      sticker,
      reaction,
      expireTimer,
      profileKey,
      group: {
        id: groupId,
        type: textsecure.protobuf.GroupContext.Type.DELIVER,
      },
    };

    if (recipients.length === 0) {
      return Promise.resolve({
        successfulIdentifiers: [],
        failoverIdentifiers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: await this.getMessageProtoObj(attrs),
      });
    }

    return this.sendMessage(attrs, options);
  },

  createGroup(targetIdentifiers, id, name, avatar, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(id);

    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    // TODO
    proto.group.members = targetIdentifiers;
    proto.group.name = name;

    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(
        targetIdentifiers,
        proto,
        Date.now(),
        options
      ).then(() => proto.group.id);
    });
  },

  updateGroup(groupId, name, avatar, targetIdentifiers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();

    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = targetIdentifiers;

    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(
        targetIdentifiers,
        proto,
        Date.now(),
        options
      ).then(() => proto.group.id);
    });
  },

  addIdentifierToGroup(groupId, newIdentifiers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.members = newIdentifiers;
    return this.sendGroupProto(newIdentifiers, proto, Date.now(), options);
  },

  setGroupName(groupId, name, groupIdentifiers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = groupIdentifiers;

    return this.sendGroupProto(groupIdentifiers, proto, Date.now(), options);
  },

  setGroupAvatar(groupId, avatar, groupIdentifiers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.members = groupIdentifiers;

    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(groupIdentifiers, proto, Date.now(), options);
    });
  },

  leaveGroup(groupId, groupIdentifiers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.QUIT;
    return this.sendGroupProto(groupIdentifiers, proto, Date.now(), options);
  },
  async sendExpirationTimerUpdateToGroup(
    groupId,
    groupIdentifiers,
    expireTimer,
    timestamp,
    profileKey,
    options
  ) {
    const myNumber = textsecure.storage.user.getNumber();
    const myUuid = textsecure.storage.user.getUuid();
    const recipients = groupIdentifiers.filter(
      identifier => identifier !== myNumber && identifier !== myUuid
    );
    const attrs = {
      recipients,
      timestamp,
      expireTimer,
      profileKey,
      flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      group: {
        id: groupId,
        type: textsecure.protobuf.GroupContext.Type.DELIVER,
      },
    };

    if (recipients.length === 0) {
      return Promise.resolve({
        successfulIdentifiers: [],
        failoverIdentifiers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: await this.getMessageProtoObj(attrs),
      });
    }

    return this.sendMessage(attrs, options);
  },
  sendExpirationTimerUpdateToIdentifier(
    identifier,
    expireTimer,
    timestamp,
    profileKey,
    options
  ) {
    return this.sendMessage(
      {
        recipients: [identifier],
        timestamp,
        expireTimer,
        profileKey,
        flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      },
      options
    );
  },
  makeProxiedRequest(url, options) {
    return this.server.makeProxiedRequest(url, options);
  },
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function MessageSenderWrapper(username, password) {
  const sender = new MessageSender(username, password);

  this.sendExpirationTimerUpdateToIdentifier = sender.sendExpirationTimerUpdateToIdentifier.bind(
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
  this.sendRequestBlockSyncMessage = sender.sendRequestBlockSyncMessage.bind(
    sender
  );

  this.sendMessageToIdentifier = sender.sendMessageToIdentifier.bind(sender);
  this.sendMessage = sender.sendMessage.bind(sender);
  this.resetSession = sender.resetSession.bind(sender);
  this.sendMessageToGroup = sender.sendMessageToGroup.bind(sender);
  this.sendTypingMessage = sender.sendTypingMessage.bind(sender);
  this.createGroup = sender.createGroup.bind(sender);
  this.updateGroup = sender.updateGroup.bind(sender);
  this.addIdentifierToGroup = sender.addIdentifierToGroup.bind(sender);
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
  this.makeProxiedRequest = sender.makeProxiedRequest.bind(sender);
  this.getMessageProto = sender.getMessageProto.bind(sender);
  this._getAttachmentSizeBucket = sender._getAttachmentSizeBucket.bind(sender);
  this.getSticker = sender.getSticker.bind(sender);
  this.getStickerPackManifest = sender.getStickerPackManifest.bind(sender);
  this.sendStickerPackSync = sender.sendStickerPackSync.bind(sender);
  this.syncViewOnceOpen = sender.syncViewOnceOpen.bind(sender);
};

textsecure.MessageSender.prototype = {
  constructor: textsecure.MessageSender,
};
