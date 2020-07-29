/* global textsecure, WebAPI, window, libloki, _, libsession */

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

textsecure.MessageSender = function MessageSenderWrapper(username, password) {
  const sender = new MessageSender(username, password);
  this.sendContactSyncMessage = sender.sendContactSyncMessage.bind(sender);
  this.sendGroupSyncMessage = sender.sendGroupSyncMessage.bind(sender);
  this.sendOpenGroupsSyncMessage = sender.sendOpenGroupsSyncMessage.bind(
    sender
  );
  this.syncReadMessages = sender.syncReadMessages.bind(sender);
  this.syncVerification = sender.syncVerification.bind(sender);
  this.makeProxiedRequest = sender.makeProxiedRequest.bind(sender);
  this.getProxiedSize = sender.getProxiedSize.bind(sender);
};

textsecure.MessageSender.prototype = {
  constructor: textsecure.MessageSender,
};
