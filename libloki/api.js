/* global window, textsecure, dcodeIO, StringView, ConversationController, _, libsession */
/* eslint-disable no-bitwise */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  const DebugFlagsEnum = {
    GROUP_SYNC_MESSAGES: 1,
    CONTACT_SYNC_MESSAGES: 2,
    SESSION_REQUEST_MESSAGES: 8,
    SESSION_MESSAGE_SENDING: 16,
    SESSION_BACKGROUND_MESSAGE: 32,
    GROUP_REQUEST_INFO: 64,
    // If you add any new flag, be sure it is bitwise safe! (unique and 2 multiples)
    ALL: 65535,
  };

  const debugFlags = DebugFlagsEnum.ALL;

  const debugLogFn = (...args) => {
    if (window.lokiFeatureFlags.debugMessageLogs) {
      window.console.warn(...args);
    }
  };

  function logSessionMessageSending(...args) {
    if (debugFlags & DebugFlagsEnum.SESSION_MESSAGE_SENDING) {
      debugLogFn(...args);
    }
  }

  function logGroupSync(...args) {
    if (debugFlags & DebugFlagsEnum.GROUP_SYNC_MESSAGES) {
      debugLogFn(...args);
    }
  }

  function logGroupRequestInfo(...args) {
    if (debugFlags & DebugFlagsEnum.GROUP_REQUEST_INFO) {
      debugLogFn(...args);
    }
  }

  function logContactSync(...args) {
    if (debugFlags & DebugFlagsEnum.CONTACT_SYNC_MESSAGES) {
      debugLogFn(...args);
    }
  }

  function logBackgroundMessage(...args) {
    if (debugFlags & DebugFlagsEnum.SESSION_BACKGROUND_MESSAGE) {
      debugLogFn(...args);
    }
  }

  async function sendSessionEstablishedMessage(pubKey) {
    const user = libsession.Types.PubKey.from(pubKey);

    const sessionEstablished = new window.libsession.Messages.Outgoing.SessionEstablishedMessage(
      { timestamp: Date.now() }
    );
    await libsession.getMessageQueue().send(user, sessionEstablished);
  }

  async function sendBackgroundMessage(pubKey, debugMessageType) {
    const backgroundMessage = textsecure.OutgoingMessage.buildBackgroundMessage(
      pubKey,
      debugMessageType
    );
    await backgroundMessage.sendToNumber(pubKey, false);
  }
  // Serialise as <Element0.length><Element0><Element1.length><Element1>...
  // This is an implementation of the reciprocal of contacts_parser.js
  function serialiseByteBuffers(buffers) {
    const result = new dcodeIO.ByteBuffer();
    buffers.forEach(buffer => {
      // bytebuffer container expands and increments
      // offset automatically
      result.writeInt32(buffer.limit);
      result.append(buffer);
    });
    result.limit = result.offset;
    result.reset();
    return result;
  }
  async function createContactSyncProtoMessage(sessionContacts) {
    if (sessionContacts.length === 0) {
      return null;
    }

    const rawContacts = await Promise.all(
      sessionContacts.map(async conversation => {
        const profile = conversation.getLokiProfile();
        const number = conversation.getNumber();
        const name = profile
          ? profile.displayName
          : conversation.getProfileName();
        const status = await conversation.safeGetVerified();
        const protoState = textsecure.storage.protocol.convertVerifiedStatusToProtoState(
          status
        );
        const verified = new textsecure.protobuf.Verified({
          state: protoState,
          destination: number,
          identityKey: StringView.hexToArrayBuffer(number),
        });
        return {
          name,
          verified,
          number,
          nickname: conversation.getNickname(),
          blocked: conversation.isBlocked(),
          expireTimer: conversation.get('expireTimer'),
        };
      })
    );
    // Convert raw contacts to an array of buffers
    const contactDetails = rawContacts
      .filter(x => x.number !== textsecure.storage.user.getNumber())
      .map(x => new textsecure.protobuf.ContactDetails(x))
      .map(x => x.encode());
    // Serialise array of byteBuffers into 1 byteBuffer
    const byteBuffer = serialiseByteBuffers(contactDetails);
    const data = new Uint8Array(byteBuffer.toArrayBuffer());
    const contacts = new textsecure.protobuf.SyncMessage.Contacts({
      data,
    });
    const syncMessage = new textsecure.protobuf.SyncMessage({
      contacts,
    });
    return syncMessage;
  }

  function createGroupSyncProtoMessage(sessionGroup) {
    // We are getting a single open group here

    const rawGroup = {
      id: window.Signal.Crypto.bytesFromString(sessionGroup.id),
      name: sessionGroup.get('name'),
      members: sessionGroup.get('members') || [],
      blocked: sessionGroup.isBlocked(),
      expireTimer: sessionGroup.get('expireTimer'),
      admins: sessionGroup.get('groupAdmins') || [],
    };

    // Convert raw group to a buffer
    const groupDetail = new textsecure.protobuf.GroupDetails(rawGroup).encode();
    // Serialise array of byteBuffers into 1 byteBuffer
    const byteBuffer = serialiseByteBuffers([groupDetail]);
    const data = new Uint8Array(byteBuffer.toArrayBuffer());
    const groups = new textsecure.protobuf.SyncMessage.Groups({
      data,
    });
    const syncMessage = new textsecure.protobuf.SyncMessage({
      groups,
    });
    return syncMessage;
  }
  function createOpenGroupsSyncProtoMessage(conversations) {
    // We only want to sync across open groups that we haven't left
    const sessionOpenGroups = conversations.filter(
      c => c.isPublic() && !c.isRss() && !c.get('left')
    );

    if (sessionOpenGroups.length === 0) {
      return null;
    }

    const openGroups = sessionOpenGroups.map(
      conversation =>
        new textsecure.protobuf.SyncMessage.OpenGroupDetails({
          url: conversation.id.split('@').pop(),
          channelId: conversation.get('channelId'),
        })
    );

    const syncMessage = new textsecure.protobuf.SyncMessage({
      openGroups,
    });
    return syncMessage;
  }
  function sendSessionRequestsToMembers(members = []) {
    // For every member, see if we need to establish a session:
    members.forEach(memberPubKey => {
      const haveSession = _.some(
        textsecure.storage.protocol.sessions,
        s => s.number === memberPubKey
      );

      const ourPubKey = textsecure.storage.user.getNumber();
      if (!haveSession && memberPubKey !== ourPubKey) {
        // eslint-disable-next-line more/no-then
        ConversationController.getOrCreateAndWait(memberPubKey, 'private').then(
          () => {
            const sessionRequestMessage = textsecure.OutgoingMessage.buildSessionRequestMessage(
              memberPubKey
            );
            sessionRequestMessage.sendToNumber(memberPubKey);
          }
        );
      }
    });
  }

  const debug = {
    logContactSync,
    logGroupSync,
    logSessionMessageSending,
    logBackgroundMessage,
    logGroupRequestInfo,
  };

  window.libloki.api = {
    sendSessionEstablishedMessage,
    sendBackgroundMessage,
    sendSessionRequestsToMembers,
    createContactSyncProtoMessage,
    createGroupSyncProtoMessage,
    createOpenGroupsSyncProtoMessage,
    debug,
  };
})();
