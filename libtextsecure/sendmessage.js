/* global textsecure, WebAPI, libsignal, window, libloki, _, libsession */

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

  uploadAvatar(attachment) {
    // isRaw is true since the data is already encrypted
    // and doesn't need to be encrypted again
    return this.makeAttachmentPointer(attachment, null, {
      isRaw: true,
      isAvatar: true,
    });
  },

  async sendContactSyncMessage(convos) {
    let convosToSync;
    if (!convos) {
      convosToSync = await libsession.Utils.SyncMessageUtils.getSyncContacts();
    } else {
      convosToSync = convos;
    }

    if (convosToSync.size === 0) {
      window.console.info('No contacts to sync.');

      return Promise.resolve();
    }
    libloki.api.debug.logContactSync(
      'Triggering contact sync message with:',
      convosToSync
    );

    // We need to sync across 3 contacts at a time
    // This is to avoid hitting storage server limit
    const chunked = _.chunk(convosToSync, 3);
    const syncMessages = await Promise.all(
      chunked.map(c => libloki.api.createContactSyncMessage(c))
    );

    const syncPromises = syncMessages.map(syncMessage =>
      libsession.getMessageQueue().sendSyncMessage(syncMessage)
    );

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
      c => c.isClosedGroup() && !c.get('left') && !c.isMediumGroup()
    );
    if (sessionGroups.length === 0) {
      window.console.info('No closed group to sync.');
      return Promise.resolve();
    }

    // We need to sync across 1 group at a time
    // This is because we could hit the storage server limit with one group
    const syncPromises = sessionGroups
      .map(c => libloki.api.createGroupSyncMessage(c))
      .map(syncMessage =>
        libsession.getMessageQueue().sendSyncMessage(syncMessage)
      );

    return Promise.all(syncPromises);
  },

  async sendOpenGroupsSyncMessage(convos) {
    // If we havn't got a primaryDeviceKey then we are in the middle of pairing
    // primaryDevicePubKey is set to our own number if we are the master device
    const primaryDeviceKey = window.storage.get('primaryDevicePubKey');
    if (!primaryDeviceKey) {
      return Promise.resolve();
    }
    const conversations = Array.isArray(convos) ? convos : [convos];

    const openGroupsConvos = await libsession.Utils.SyncMessageUtils.filterOpenGroupsConvos(
      conversations
    );

    if (!openGroupsConvos.length) {
      window.log.info('No open groups to sync');
      return Promise.resolve();
    }

    // Send the whole list of open groups in a single message
    const openGroupsDetails = openGroupsConvos.map(conversation => ({
      url: conversation.id,
      channelId: conversation.get('channelId'),
    }));
    const openGroupsSyncParams = {
      timestamp: Date.now(),
      openGroupsDetails,
    };
    const openGroupsSyncMessage = new libsession.Messages.Outgoing.OpenGroupSyncMessage(
      openGroupsSyncParams
    );

    return libsession.getMessageQueue().sendSyncMessage(openGroupsSyncMessage);
  },
  async sendBlockedListSyncMessage() {
    // If we havn't got a primaryDeviceKey then we are in the middle of pairing
    // primaryDevicePubKey is set to our own number if we are the master device
    const primaryDeviceKey = window.storage.get('primaryDevicePubKey');
    if (!primaryDeviceKey) {
      return Promise.resolve();
    }
    const convos = window.getConversations().models;

    const conversations = Array.isArray(convos) ? convos : [convos];

    const blockedConvos = await libsession.Utils.SyncMessageUtils.filterBlockedNumbers(
      conversations
    );
    // currently we only sync user blocked, not groups
    const blockedSyncMessage = new libsession.Messages.Outgoing.BlockedListSyncMessage(
      {
        timestamp: Date.now(),
        numbers: blockedConvos.map(n => n.id),
        groups: [],
      }
    );
    return libsession.getMessageQueue().sendSyncMessage(blockedSyncMessage);
  },
  syncReadMessages(reads) {
    const myDevice = textsecure.storage.user.getDeviceId();
    // FIXME currently not in used
    if (myDevice !== 1 && myDevice !== '1') {
      const syncReadMessages = new libsession.Messages.Outgoing.SyncReadMessage(
        {
          timestamp: Date.now(),
          readMessages: reads,
        }
      );
      return libsession.getMessageQueue().sendSyncMessage(syncReadMessages);
    }

    return Promise.resolve();
  },
  async syncVerification(destination, state, identityKey) {
    const myDevice = textsecure.storage.user.getDeviceId();
    // FIXME currently not in used
    if (myDevice === 1 || myDevice === '1') {
      return Promise.resolve();
    }
    // send a session established message (used as a nullMessage)
    const destinationPubKey = new libsession.Types.PubKey(destination);

    const sessionEstablished = new window.libsession.Messages.Outgoing.SessionEstablishedMessage(
      { timestamp: Date.now() }
    );
    const { padding } = sessionEstablished;
    await libsession
      .getMessageQueue()
      .send(destinationPubKey, sessionEstablished);

    const verifiedSyncParams = {
      state,
      destination: destinationPubKey,
      identityKey,
      padding,
      timestamp: Date.now(),
    };
    const verifiedSyncMessage = new window.libsession.Messages.Outgoing.VerifiedSyncMessage(
      verifiedSyncParams
    );

    return libsession.getMessageQueue().sendSyncMessage(verifiedSyncMessage);
  },

  makeProxiedRequest(url, options) {
    return this.server.makeProxiedRequest(url, options);
  },
  getProxiedSize(url) {
    return this.server.getProxiedSize(url);
  },
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function MessageSenderWrapper() {
  const sender = new MessageSender();
  this.sendContactSyncMessage = sender.sendContactSyncMessage.bind(sender);
  this.sendGroupSyncMessage = sender.sendGroupSyncMessage.bind(sender);
  this.sendOpenGroupsSyncMessage = sender.sendOpenGroupsSyncMessage.bind(
    sender
  );
  this.uploadAvatar = sender.uploadAvatar.bind(sender);
  this.syncReadMessages = sender.syncReadMessages.bind(sender);
  this.syncVerification = sender.syncVerification.bind(sender);
  this.makeProxiedRequest = sender.makeProxiedRequest.bind(sender);
  this.getProxiedSize = sender.getProxiedSize.bind(sender);
  this.sendBlockedListSyncMessage = sender.sendBlockedListSyncMessage.bind(
    sender
  );
};

textsecure.MessageSender.prototype = {
  constructor: textsecure.MessageSender,
};
