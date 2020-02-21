/* global window, textsecure, dcodeIO, StringView, ConversationController */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  async function sendBackgroundMessage(pubKey) {
    return sendOnlineBroadcastMessage(pubKey);
  }

  async function sendOnlineBroadcastMessage(pubKey, isPing = false) {
    const authorisation = await window.libloki.storage.getGrantAuthorisationForSecondaryPubKey(
      pubKey
    );
    if (authorisation && authorisation.primaryDevicePubKey !== pubKey) {
      sendOnlineBroadcastMessage(authorisation.primaryDevicePubKey);
      return;
    }
    const p2pAddress = null;
    const p2pPort = null;
    // We result loki address message for sending "background" messages
    const type = textsecure.protobuf.LokiAddressMessage.Type.HOST_UNREACHABLE;

    const lokiAddressMessage = new textsecure.protobuf.LokiAddressMessage({
      p2pAddress,
      p2pPort,
      type,
    });
    const content = new textsecure.protobuf.Content({
      lokiAddressMessage,
    });

    const options = { messageType: 'onlineBroadcast', isPing };
    // Send a empty message with information about how to contact us directly
    const outgoingMessage = new textsecure.OutgoingMessage(
      null, // server
      Date.now(), // timestamp,
      [pubKey], // numbers
      content, // message
      true, // silent
      () => null, // callback
      options
    );
    await outgoingMessage.sendToNumber(pubKey);
  }

  function createPairingAuthorisationProtoMessage({
    primaryDevicePubKey,
    secondaryDevicePubKey,
    requestSignature,
    grantSignature,
  }) {
    if (!primaryDevicePubKey || !secondaryDevicePubKey || !requestSignature) {
      throw new Error(
        'createPairingAuthorisationProtoMessage: pubkeys missing'
      );
    }
    if (requestSignature.constructor !== ArrayBuffer) {
      throw new Error(
        'createPairingAuthorisationProtoMessage expects a signature as ArrayBuffer'
      );
    }
    if (grantSignature && grantSignature.constructor !== ArrayBuffer) {
      throw new Error(
        'createPairingAuthorisationProtoMessage expects a signature as ArrayBuffer'
      );
    }
    return new textsecure.protobuf.PairingAuthorisationMessage({
      requestSignature: new Uint8Array(requestSignature),
      grantSignature: grantSignature ? new Uint8Array(grantSignature) : null,
      primaryDevicePubKey,
      secondaryDevicePubKey,
    });
  }

  function sendUnpairingMessageToSecondary(pubKey) {
    const flags = textsecure.protobuf.DataMessage.Flags.UNPAIRING_REQUEST;
    const dataMessage = new textsecure.protobuf.DataMessage({
      flags,
    });
    const content = new textsecure.protobuf.Content({
      dataMessage,
    });
    const options = { messageType: 'device-unpairing' };
    const outgoingMessage = new textsecure.OutgoingMessage(
      null, // server
      Date.now(), // timestamp,
      [pubKey], // numbers
      content, // message
      true, // silent
      () => null, // callback
      options
    );
    return outgoingMessage.sendToNumber(pubKey);
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
  async function createContactSyncProtoMessage(conversations) {
    // Extract required contacts information out of conversations
    const sessionContacts = conversations.filter(
      c => c.isPrivate() && !c.isSecondaryDevice()
    );

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
  function createGroupSyncProtoMessage(conversations) {
    // We only want to sync across closed groups that we haven't left
    const sessionGroups = conversations.filter(
      c => c.isClosedGroup() && !c.get('left') && c.isFriend()
    );

    if (sessionGroups.length === 0) {
      return null;
    }

    const rawGroups = sessionGroups.map(conversation => ({
      id: window.Signal.Crypto.bytesFromString(conversation.id),
      name: conversation.get('name'),
      members: conversation.get('members') || [],
      blocked: conversation.isBlocked(),
      expireTimer: conversation.get('expireTimer'),
      admins: conversation.get('groupAdmins') || [],
    }));

    // Convert raw groups to an array of buffers
    const groupDetails = rawGroups
      .map(x => new textsecure.protobuf.GroupDetails(x))
      .map(x => x.encode());
    // Serialise array of byteBuffers into 1 byteBuffer
    const byteBuffer = serialiseByteBuffers(groupDetails);
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
  async function sendPairingAuthorisation(authorisation, recipientPubKey) {
    const pairingAuthorisation = createPairingAuthorisationProtoMessage(
      authorisation
    );
    const ourNumber = textsecure.storage.user.getNumber();
    const ourConversation = await ConversationController.getOrCreateAndWait(
      ourNumber,
      'private'
    );
    const content = new textsecure.protobuf.Content({
      pairingAuthorisation,
    });
    const isGrant = authorisation.primaryDevicePubKey === ourNumber;
    if (isGrant) {
      // Send profile name to secondary device
      const lokiProfile = ourConversation.getLokiProfile();
      // profile.avatar is the path to the local image
      // replace with the avatar URL
      const avatarPointer = ourConversation.get('avatarPointer');
      lokiProfile.avatar = avatarPointer;
      const profile = new textsecure.protobuf.DataMessage.LokiProfile(
        lokiProfile
      );
      const profileKey = window.storage.get('profileKey');
      const dataMessage = new textsecure.protobuf.DataMessage({
        profile,
        profileKey,
      });
      content.dataMessage = dataMessage;
    }
    // Send
    const options = { messageType: 'pairing-request' };
    const p = new Promise((resolve, reject) => {
      const timestamp = Date.now();

      const outgoingMessage = new textsecure.OutgoingMessage(
        null, // server
        timestamp,
        [recipientPubKey], // numbers
        content, // message
        true, // silent
        result => {
          // callback
          if (result.errors.length > 0) {
            reject(result.errors[0]);
          } else {
            resolve();
          }
        },
        options
      );
      outgoingMessage.sendToNumber(recipientPubKey);
    });
    return p;
  }

  window.libloki.api = {
    sendBackgroundMessage,
    sendOnlineBroadcastMessage,
    sendPairingAuthorisation,
    createPairingAuthorisationProtoMessage,
    sendUnpairingMessageToSecondary,
    createContactSyncProtoMessage,
    createGroupSyncProtoMessage,
    createOpenGroupsSyncProtoMessage,
  };
})();
