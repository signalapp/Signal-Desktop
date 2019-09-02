/* global window, textsecure, log */

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
        if (pubKey === textsecure.storage.user.getNumber()) return;
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

    if (!window.localLokiServer.isListening()) {
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

  async function sendPairingAuthorisation(authorisation, recipientPubKey) {
    const pairingAuthorisation = createPairingAuthorisationProtoMessage(
      authorisation
    );
    // Send profile name to secondary device
    const ourNumber = textsecure.storage.user.getNumber();
    const conversation = await window.ConversationController.getOrCreateAndWait(
      ourNumber,
      'private'
    );
    const lokiProfile = conversation.getLokiProfile();
    const profile = new textsecure.protobuf.DataMessage.LokiProfile(lokiProfile);
    const dataMessage = new textsecure.protobuf.DataMessage({
      profile,
    });
    const content = new textsecure.protobuf.Content({
      pairingAuthorisation,
      dataMessage,
    });
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
  };
})();
