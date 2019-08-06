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

  async function sendPairingAuthorisation(secondaryDevicePubKey, signature) {
    const pairingAuthorisation = new textsecure.protobuf.PairingAuthorisationMessage(
      {
        signature,
        primaryDevicePubKey: textsecure.storage.user.getNumber(),
        secondaryDevicePubKey,
        type:
          textsecure.protobuf.PairingAuthorisationMessage.Type.PAIRING_REQUEST,
      }
    );
    const content = new textsecure.protobuf.Content({
      pairingAuthorisation,
    });
    const options = {};
    // Send a empty message with information about how to contact us directly
    const outgoingMessage = new textsecure.OutgoingMessage(
      null, // server
      Date.now(), // timestamp,
      [secondaryDevicePubKey], // numbers
      content, // message
      true, // silent
      () => null, // callback
      options
    );
    await outgoingMessage.sendToNumber(secondaryDevicePubKey);
  }

  window.libloki.api = {
    sendBackgroundMessage,
    sendOnlineBroadcastMessage,
    broadcastOnlineStatus,
    sendPairingAuthorisation,
  };
})();
