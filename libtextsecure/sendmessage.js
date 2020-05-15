/* global _, textsecure, WebAPI, libsignal, OutgoingMessage, window, libloki */

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
  this.preview = options.preview;
  this.group = options.group;
  this.flags = options.flags;
  this.recipients = options.recipients;
  this.timestamp = options.timestamp;
  this.needsSync = options.needsSync;
  this.expireTimer = options.expireTimer;
  this.profileKey = options.profileKey;
  this.profile = options.profile;
  this.groupInvitation = options.groupInvitation;
  this.sessionRestoration = options.sessionRestoration || false;

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

    // Set the loki profile
    if (this.profile) {
      const profile = new textsecure.protobuf.DataMessage.LokiProfile();
      if (this.profile.displayName) {
        profile.displayName = this.profile.displayName;
      }

      const conversation = window.ConversationController.get(
        textsecure.storage.user.getNumber()
      );
      const avatarPointer = conversation.get('avatarPointer');
      if (avatarPointer) {
        profile.avatar = avatarPointer;
      }
      proto.profile = profile;
    }

    if (this.groupInvitation) {
      proto.groupInvitation = new textsecure.protobuf.DataMessage.GroupInvitation(
        {
          serverAddress: this.groupInvitation.serverAddress,
          channelId: this.groupInvitation.channelId,
          serverName: this.groupInvitation.serverName,
        }
      );
    }

    if (this.sessionRestoration) {
      proto.flags = textsecure.protobuf.DataMessage.Flags.SESSION_RESTORE;
    }

    this.dataMessage = proto;
    return proto;
  },
  toArrayBuffer() {
    return this.toProto().toArrayBuffer();
  },
};

function MessageSender() {
  this.server = WebAPI.connect();
  this.pendingMessages = {};
}

MessageSender.prototype = {
  constructor: MessageSender,

  //  makeAttachmentPointer :: Attachment -> Promise AttachmentPointerProto
  async makeAttachmentPointer(attachment, publicServer = null, options = {}) {
    const { isRaw = false, isAvatar = false } = options;
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
    let attachmentData;
    const server = publicServer || this.server;

    if (publicServer || isRaw) {
      attachmentData = attachment.data;
    } else {
      proto.key = libsignal.crypto.getRandomBytes(64);
      const iv = libsignal.crypto.getRandomBytes(16);
      const result = await textsecure.crypto.encryptAttachment(
        attachment.data,
        proto.key,
        iv
      );
      proto.digest = result.digest;
      attachmentData = result.ciphertext;
    }

    const result = isAvatar
      ? await server.putAvatar(attachmentData)
      : await server.putAttachment(attachmentData);

    if (!result) {
      return Promise.reject(
        new Error('Failed to upload data to attachment fileserver')
      );
    }
    const { url, id } = result;
    proto.id = id;
    proto.url = url;
    proto.contentType = attachment.contentType;

    if (attachment.size) {
      proto.size = attachment.size;
    }
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

  uploadAttachments(message, publicServer) {
    return Promise.all(
      message.attachments.map(attachment =>
        this.makeAttachmentPointer(attachment, publicServer)
      )
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

  async uploadLinkPreviews(message, publicServer) {
    try {
      const preview = await Promise.all(
        (message.preview || []).map(async item => ({
          ...item,
          image: await this.makeAttachmentPointer(item.image, publicServer),
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

  uploadThumbnails(message, publicServer) {
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

        return makePointer(thumbnail, publicServer).then(pointer => {
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
    const publicServer =
      options.publicSendData && options.publicSendData.serverAPI;

    return Promise.all([
      this.uploadAttachments(message, publicServer),
      this.uploadThumbnails(message, publicServer),
      this.uploadLinkPreviews(message, publicServer),
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

    const ourNumber = textsecure.storage.user.getNumber();

    // Check wether we have the keys to start a session with the user
    const hasKeys = async number => {
      try {
        const [preKey, signedPreKey] = await Promise.all([
          textsecure.storage.protocol.loadContactPreKey(number),
          textsecure.storage.protocol.loadContactSignedPreKey(number),
        ]);
        return preKey !== undefined && signedPreKey !== undefined;
      } catch (e) {
        return false;
      }
    };

    // Note: Since we're just doing independant tasks,
    // using `async` in the `forEach` loop should be fine.
    // If however we want to use the results from forEach then
    // we would need to convert this to a Promise.all(numbers.map(...))
    numbers.forEach(async number => {
      // Note: if we are sending a private group message, we do our best to
      // ensure we have signal protocol sessions with every member, but if we
      // fail, let's at least send messages to those members with which we do:
      const haveSession = _.some(
        textsecure.storage.protocol.sessions,
        s => s.number === number
      );

      let keysFound = false;
      // If we don't have a session but we already have prekeys to
      // start communication then we should use them
      if (!haveSession && !options.isPublic) {
        keysFound = await hasKeys(number);
      }

      if (
        number === ourNumber ||
        haveSession ||
        keysFound ||
        options.isPublic ||
        options.isMediumGroup ||
        options.messageType === 'friend-request'
      ) {
        const outgoing = new OutgoingMessage(
          this.server,
          timestamp,
          numbers,
          message,
          silent,
          callback,
          options
        );
        this.queueJobForNumber(number, () => outgoing.sendToNumber(number));
      } else {
        window.log.error(`No session for number: ${number}`);
        const isGroupMessage = !!(
          message &&
          message.dataMessage &&
          message.dataMessage.group
        );
        // If it was a message to a group then we need to send a session request
        if (isGroupMessage) {
          const sessionRequestMessage = textsecure.OutgoingMessage.buildSessionRequestMessage(
            number
          );
          sessionRequestMessage.sendToNumber(number);
        }
      }
    });
  },

  sendMessageProtoAndWait(timestamp, numbers, message, silent, options = {}) {
    return new Promise((resolve, reject) => {
      const callback = result => {
        if (result && result.errors && result.errors.length > 0) {
          return reject(result);
        }

        return resolve(result);
      };

      this.sendMessageProto(
        timestamp,
        numbers,
        message,
        callback,
        silent,
        options
      );
    });
  },

  sendIndividualProto(number, proto, timestamp, silent, options = {}) {
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

  async sendSyncMessage(
    encodedDataMessage,
    timestamp,
    destination,
    expirationStartTimestamp,
    sentTo = [],
    unidentifiedDeliveries = [],
    options
  ) {
    const primaryDeviceKey =
      window.storage.get('primaryDevicePubKey') ||
      textsecure.storage.user.getNumber();
    const allOurDevices = (await libloki.storage.getAllDevicePubKeysForPrimaryPubKey(
      primaryDeviceKey
    ))
      // Don't send to ourselves
      .filter(pubKey => pubKey !== textsecure.storage.user.getNumber());
    if (allOurDevices.length === 0) {
      return null;
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
      primaryDeviceKey,
      contentMessage,
      Date.now(),
      silent,
      options
    );
  },

  async getProfile() {
    throw new Error('Signal code called. This needs to be removed');
  },

  uploadAvatar(attachment) {
    // isRaw is true since the data is already encrypted
    // and doesn't need to be encrypted again
    return this.makeAttachmentPointer(attachment, null, {
      isRaw: true,
      isAvatar: true,
    });
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
      const debugMessageType =
        window.textsecure.OutgoingMessage.DebugMessageType.REQUEST_SYNC_SEND;

      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        { ...options, debugMessageType }
      );
    }

    return Promise.resolve();
  },

  async sendContactSyncMessage(conversations) {
    // If we havn't got a primaryDeviceKey then we are in the middle of pairing
    // primaryDevicePubKey is set to our own number if we are the master device
    const primaryDeviceKey = window.storage.get('primaryDevicePubKey');
    if (!primaryDeviceKey) {
      return Promise.resolve();
    }
    // Extract required contacts information out of conversations
    const sessionContacts = conversations.filter(
      c => c.isPrivate() && !c.isSecondaryDevice() && c.isFriend()
    );
    if (sessionContacts.length === 0) {
      return Promise.resolve();
    }
    // We need to sync across 3 contacts at a time
    // This is to avoid hitting storage server limit
    const chunked = _.chunk(sessionContacts, 3);
    const syncMessages = await Promise.all(
      chunked.map(c => libloki.api.createContactSyncProtoMessage(c))
    );
    const syncPromises = syncMessages
      .filter(message => message != null)
      .map(syncMessage => {
        const contentMessage = new textsecure.protobuf.Content();
        contentMessage.syncMessage = syncMessage;

        const silent = true;

        const debugMessageType =
          window.textsecure.OutgoingMessage.DebugMessageType.CONTACT_SYNC_SEND;

        return this.sendIndividualProto(
          primaryDeviceKey,
          contentMessage,
          Date.now(),
          silent,
          { debugMessageType } // options
        );
      });

    return Promise.all(syncPromises);
  },

  sendGroupSyncMessage(conversations) {
    // If we havn't got a primaryDeviceKey then we are in the middle of pairing
    // primaryDevicePubKey is set to our own number if we are the master device
    const primaryDeviceKey = window.storage.get('primaryDevicePubKey');
    if (!primaryDeviceKey) {
      window.console.debug('sendGroupSyncMessage: no primary device pubkey');
      return Promise.resolve();
    }
    // We only want to sync across closed groups that we haven't left
    const sessionGroups = conversations.filter(
      c => c.isClosedGroup() && !c.get('left') && c.isFriend()
    );
    if (sessionGroups.length === 0) {
      window.console.info('No closed group to sync.');
      return Promise.resolve();
    }

    // We need to sync across 1 group at a time
    // This is because we could hit the storage server limit with one group
    const syncPromises = sessionGroups
      .map(c => libloki.api.createGroupSyncProtoMessage(c))
      .filter(message => message != null)
      .map(syncMessage => {
        const contentMessage = new textsecure.protobuf.Content();
        contentMessage.syncMessage = syncMessage;

        const silent = true;
        const debugMessageType =
          window.textsecure.OutgoingMessage.DebugMessageType
            .CLOSED_GROUP_SYNC_SEND;

        return this.sendIndividualProto(
          primaryDeviceKey,
          contentMessage,
          Date.now(),
          silent,
          { debugMessageType } // options
        );
      });

    return Promise.all(syncPromises);
  },

  sendOpenGroupsSyncMessage(conversations) {
    // If we havn't got a primaryDeviceKey then we are in the middle of pairing
    // primaryDevicePubKey is set to our own number if we are the master device
    const primaryDeviceKey = window.storage.get('primaryDevicePubKey');
    if (!primaryDeviceKey) {
      return Promise.resolve();
    }

    // Send the whole list of open groups in a single message

    const openGroupsSyncMessage = libloki.api.createOpenGroupsSyncProtoMessage(
      conversations
    );

    if (!openGroupsSyncMessage) {
      window.log.info('No open groups to sync');
      return Promise.resolve();
    }

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = openGroupsSyncMessage;

    const silent = true;
    const debugMessageType =
      window.textsecure.OutgoingMessage.DebugMessageType.OPEN_GROUP_SYNC_SEND;

    return this.sendIndividualProto(
      primaryDeviceKey,
      contentMessage,
      Date.now(),
      silent,
      { debugMessageType } // options
    );
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

  async sendTypingMessage(options = {}, sendOptions = {}) {
    const ACTION_ENUM = textsecure.protobuf.TypingMessage.Action;
    const { recipientId, groupId, groupNumbers, isTyping, timestamp } = options;

    // We don't want to send typing messages to our other devices, but we will
    //   in the group case.
    const myNumber = textsecure.storage.user.getNumber();
    const primaryDevicePubkey = window.storage.get('primaryDevicePubKey');
    if (recipientId && primaryDevicePubkey === recipientId) {
      return null;
    }

    if (!recipientId && !groupId) {
      throw new Error('Need to provide either recipientId or groupId!');
    }

    const recipients = groupId
      ? _.without(groupNumbers, myNumber)
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
    // We always assume that only primary device is a member in the group
    const primaryDeviceKey =
      window.storage.get('primaryDevicePubKey') ||
      textsecure.storage.user.getNumber();
    const numbers = providedNumbers.filter(
      number => number !== primaryDeviceKey
    );
    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: proto.toArrayBuffer(),
      });
    }

    const sendPromise = new Promise((resolve, reject) => {
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

    return sendPromise.then(result => {
      // Sync the group message to our other devices
      const encoded = textsecure.protobuf.DataMessage.encode(proto);
      this.sendSyncMessage(encoded, timestamp, null, null, [], [], options);
      return result;
    });
  },

  async getMessageProto(
    number,
    body,
    attachments,
    quote,
    preview,
    timestamp,
    expireTimer,
    profileKey,
    flags
  ) {
    const attributes = {
      recipients: [number],
      body,
      timestamp,
      attachments,
      quote,
      preview,
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
    ]);

    return message.toArrayBuffer();
  },

  getOurProfile() {
    try {
      // Secondary devices have their profile stored
      // in their primary device's conversation
      const ourNumber = window.storage.get('primaryDevicePubKey');
      const conversation = window.ConversationController.get(ourNumber);
      return conversation.getLokiProfile();
    } catch (e) {
      window.log.error(`Failed to get our profile: ${e}`);
      return null;
    }
  },

  async sendMessageToNumber(
    number,
    messageText,
    attachments,
    quote,
    preview,
    timestamp,
    expireTimer,
    profileKey,
    options
  ) {
    const profile = this.getOurProfile();

    const flags = options.sessionRequest
      ? textsecure.protobuf.DataMessage.Flags.SESSION_REQUEST
      : undefined;

    const { groupInvitation, sessionRestoration } = options;

    return this.sendMessage(
      {
        recipients: [number],
        body: messageText,
        timestamp,
        attachments,
        quote,
        preview,
        needsSync: true,
        expireTimer,
        profileKey,
        profile,
        flags,
        groupInvitation,
        sessionRestoration,
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
    // The actual deletion of the session now happens later
    // as we need to ensure the other contact has successfully
    // switch to a new session first.
    return this.sendIndividualProto(
      number,
      proto,
      timestamp,
      silent,
      options
    ).catch(logError('resetSession/sendToContact error:'));
  },

  async sendMessageToGroup(
    groupId,
    groupNumbers,
    messageText,
    attachments,
    quote,
    preview,
    timestamp,
    expireTimer,
    profileKey,
    options
  ) {
    // We always assume that only primary device is a member in the group
    const primaryDeviceKey =
      window.storage.get('primaryDevicePubKey') ||
      textsecure.storage.user.getNumber();
    let numbers = groupNumbers.filter(number => number !== primaryDeviceKey);
    if (options.isPublic) {
      numbers = [groupId];
    }
    const profile = this.getOurProfile();

    let group;
    // Medium groups don't need this info
    if (!options.isMediumGroup) {
      group = {
        id: groupId,
        type: textsecure.protobuf.GroupContext.Type.DELIVER,
      };
    }

    const attrs = {
      recipients: numbers,
      body: messageText,
      timestamp,
      attachments,
      quote,
      preview,
      needsSync: true,
      expireTimer,
      profileKey,
      profile,
      group,
    };

    if (numbers.length === 0) {
      return {
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: await this.getMessageProtoObj(attrs),
      };
    }

    return this.sendMessage(attrs, options);
  },

  async updateMediumGroup(members, groupUpdateProto) {
    await this.sendGroupProto(members, groupUpdateProto, Date.now(), {
      isPublic: false,
    });
  },

  async updateGroup(
    groupId,
    name,
    avatar,
    members,
    admins,
    recipients,
    options
  ) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();

    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = members;

    const primaryDeviceKey =
      window.storage.get('primaryDevicePubKey') ||
      textsecure.storage.user.getNumber();
    proto.group.admins = [primaryDeviceKey];

    const attachment = await this.makeAttachmentPointer(avatar);

    proto.group.avatar = attachment;
    // TODO: re-enable this once we have attachments
    proto.group.avatar = null;
    await this.sendGroupProto(recipients, proto, Date.now(), options);

    return proto.group.id;
  },

  addNumberToGroup(groupId, newNumbers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.members = newNumbers;
    return this.sendGroupProto(newNumbers, proto, Date.now(), options);
  },

  setGroupName(groupId, name, groupNumbers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = groupNumbers;

    return this.sendGroupProto(groupNumbers, proto, Date.now(), options);
  },

  setGroupAvatar(groupId, avatar, groupNumbers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.members = groupNumbers;

    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(groupNumbers, proto, Date.now(), options);
    });
  },

  requestGroupInfo(groupId, groupNumbers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.REQUEST_INFO;
    libloki.api.debug.logGroupRequestInfo(
      `Sending GROUP_TYPES.REQUEST_INFO to: ${groupNumbers}, about groupId ${groupId}.`
    );
    return this.sendGroupProto(groupNumbers, proto, Date.now(), options);
  },

  leaveGroup(groupId, groupNumbers, options) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.QUIT;
    return this.sendGroupProto(groupNumbers, proto, Date.now(), options);
  },
  async sendExpirationTimerUpdateToGroup(
    groupId,
    groupNumbers,
    expireTimer,
    timestamp,
    profileKey,
    options
  ) {
    // We always assume that only primary device is a member in the group
    const primaryDeviceKey =
      window.storage.get('primaryDevicePubKey') ||
      textsecure.storage.user.getNumber();
    const numbers = groupNumbers.filter(number => number !== primaryDeviceKey);

    const attrs = {
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
    };

    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        unidentifiedDeliveries: [],
        dataMessage: await this.getMessageProtoObj(attrs),
      });
    }

    return this.sendMessage(attrs, options);
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
  makeProxiedRequest(url, options) {
    return this.server.makeProxiedRequest(url, options);
  },
  getProxiedSize(url) {
    return this.server.getProxiedSize(url);
  },
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function MessageSenderWrapper(username, password) {
  const sender = new MessageSender(username, password);

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
  this.sendContactSyncMessage = sender.sendContactSyncMessage.bind(sender);
  this.sendGroupSyncMessage = sender.sendGroupSyncMessage.bind(sender);
  this.sendOpenGroupsSyncMessage = sender.sendOpenGroupsSyncMessage.bind(
    sender
  );
  this.sendRequestConfigurationSyncMessage = sender.sendRequestConfigurationSyncMessage.bind(
    sender
  );
  this.sendMessageToNumber = sender.sendMessageToNumber.bind(sender);
  this.sendMessage = sender.sendMessage.bind(sender);
  this.resetSession = sender.resetSession.bind(sender);
  this.sendMessageToGroup = sender.sendMessageToGroup.bind(sender);
  this.sendTypingMessage = sender.sendTypingMessage.bind(sender);
  this.updateGroup = sender.updateGroup.bind(sender);
  this.updateMediumGroup = sender.updateMediumGroup.bind(sender);
  this.addNumberToGroup = sender.addNumberToGroup.bind(sender);
  this.setGroupName = sender.setGroupName.bind(sender);
  this.setGroupAvatar = sender.setGroupAvatar.bind(sender);
  this.requestGroupInfo = sender.requestGroupInfo.bind(sender);
  this.leaveGroup = sender.leaveGroup.bind(sender);
  this.sendSyncMessage = sender.sendSyncMessage.bind(sender);
  this.getProfile = sender.getProfile.bind(sender);
  this.uploadAvatar = sender.uploadAvatar.bind(sender);
  this.syncReadMessages = sender.syncReadMessages.bind(sender);
  this.syncVerification = sender.syncVerification.bind(sender);
  this.sendDeliveryReceipt = sender.sendDeliveryReceipt.bind(sender);
  this.sendReadReceipts = sender.sendReadReceipts.bind(sender);
  this.makeProxiedRequest = sender.makeProxiedRequest.bind(sender);
  this.getProxiedSize = sender.getProxiedSize.bind(sender);
  this.getMessageProto = sender.getMessageProto.bind(sender);
};

textsecure.MessageSender.prototype = {
  constructor: textsecure.MessageSender,
};
