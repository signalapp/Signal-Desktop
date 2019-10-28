/* global window, textsecure, log, Whisper, dcodeIO, StringView, ConversationController */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  async function sendBackgroundMessage(pubKey) {
    return sendOnlineBroadcastMessage(pubKey);
  }

  async function broadcastOnlineStatus() {
    const friendKeys = await window.Signal.Data.getPubKeysWithFriendStatus(
      window.friends.friendRequestStatusEnum.friends
    );
    await Promise.all(
      friendKeys.map(async pubKey => {
        if (pubKey === textsecure.storage.user.getNumber()) {
          return;
        }
        try {
          await sendOnlineBroadcastMessage(pubKey);
        } catch (e) {
          log.warn(`Failed to send online broadcast message to ${pubKey}`);
        }
      })
    );
  }

  async function sendOnlineBroadcastMessage(pubKey, isPing = false) {
    let p2pAddress = null;
    let p2pPort = null;
    let type;

    if (!window.localLokiServer || !window.localLokiServer.isListening()) {
      type = textsecure.protobuf.LokiAddressMessage.Type.HOST_UNREACHABLE;
    } else {
      // clearnet change: getMyLokiAddress -> getMyClearIP
      // const myLokiAddress = await window.lokiSnodeAPI.getMyLokiAddress();
      const myIp = await window.lokiSnodeAPI.getMyClearIp();
      p2pAddress = `https://${myIp}`;
      p2pPort = window.localLokiServer.getPublicPort();
      type = textsecure.protobuf.LokiAddressMessage.Type.HOST_REACHABLE;
    }

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
    type,
  }) {
    if (
      !primaryDevicePubKey ||
      !secondaryDevicePubKey ||
      !requestSignature ||
      typeof type !== 'number'
    ) {
      throw new Error(
        'createPairingAuthorisationProtoMessage: pubkeys or type is not set'
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
      type,
    });
  }
  // Serialise as <Element0.length><Element0><Element1.length><Element1>...
  // This is an implementation of the reciprocal of contacts_parser.js
  function serialiseByteBuffers(buffers) {
    const result = new dcodeIO.ByteBuffer();
    buffers.forEach(buffer => {
      // bytebuffer container expands and increments
      // offset automatically
      result.writeVarint32(buffer.limit);
      result.append(buffer);
    });
    result.limit = result.offset;
    result.reset();
    return result;
  }
  async function createContactSyncProtoMessage() {
    const conversations = await window.Signal.Data.getConversationsWithFriendStatus(
      window.friends.friendRequestStatusEnum.friends,
      { ConversationCollection: Whisper.ConversationCollection }
    );
    // Extract required contacts information out of conversations
    const rawContacts = conversations.map(conversation => {
      const profile = conversation.getLokiProfile();
      const number = conversation.getNumber();
      const name = profile
        ? profile.displayName
        : conversation.getProfileName();
      const status = conversation.safeGetVerified();
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
    });
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
  async function sendPairingAuthorisation(authorisation, recipientPubKey) {
    const pairingAuthorisation = createPairingAuthorisationProtoMessage(
      authorisation
    );
    // Send profile name to secondary device
    const ourNumber = textsecure.storage.user.getNumber();
    const conversation = await ConversationController.getOrCreateAndWait(
      ourNumber,
      'private'
    );
    const lokiProfile = conversation.getLokiProfile();
    const profile = new textsecure.protobuf.DataMessage.LokiProfile(
      lokiProfile
    );
    const dataMessage = new textsecure.protobuf.DataMessage({
      profile,
    });
    // Attach contact list
    // TODO: Reenable sending of the syncmessage for pairing requests
    // const syncMessage = await createContactSyncProtoMessage();
    const content = new textsecure.protobuf.Content({
      pairingAuthorisation,
      dataMessage,
      // syncMessage,
    });
    // Send
    const options = { messageType: 'pairing-request' };
    const p = new Promise((resolve, reject) => {
      const outgoingMessage = new textsecure.OutgoingMessage(
        null, // server
        Date.now(), // timestamp,
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
    broadcastOnlineStatus,
    sendPairingAuthorisation,
    createPairingAuthorisationProtoMessage,
    createContactSyncProtoMessage,
  };
})();
