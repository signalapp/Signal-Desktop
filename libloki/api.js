/* global window, textsecure, log */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  async function sendFriendRequestAccepted(pubKey) {
    return sendEmptyMessage(pubKey, true);
  }

  async function broadcastOnlineStatus() {
    const friendKeys = await window.Signal.Data.getPubKeysWithFriendStatus(
      window.friends.friendRequestStatusEnum.friends
    );
    await Promise.all(
      friendKeys.map(async pubKey => {
        try {
          await sendOnlineBroadcastMessage(pubKey);
        } catch (e) {
          log.warn(`Failed to send online broadcast message to ${pubKey}`);
        }
      })
    );
  }

  async function sendOnlineBroadcastMessage(pubKey, isPing = false) {
    const myLokiAddress = await window.lokiSnodeAPI.getMyLokiAddress();
    const lokiAddressMessage = new textsecure.protobuf.LokiAddressMessage({
      p2pAddress: `http://${myLokiAddress}`,
      p2pPort: parseInt(window.localServerPort, 10),
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

  async function sendEmptyMessage(pubKey, sendContentMessage = false) {
    const options = {};
    // send an empty message.
    if (sendContentMessage) {
      // The logic downstream will attach the prekeys and our profile.
      await textsecure.messaging.sendMessageToNumber(
        pubKey, // number
        null, // messageText
        [], // attachments
        null, // quote
        [], // preview
        Date.now(), // timestamp
        null, // expireTimer
        null, // profileKey
        options
      );
    } else {
      // empty content message
      const content = new textsecure.protobuf.Content();

      // will be called once the transmission succeeded or failed
      const callback = res => {
        if (res.errors.length > 0) {
          res.errors.forEach(error => log.error(error));
        } else {
          log.info('empty message sent successfully');
        }
      };
      // send an empty message. The logic in ougoing_message will attach the prekeys.
      const outgoingMessage = new textsecure.OutgoingMessage(
        null, // server
        Date.now(), // timestamp,
        [pubKey], // numbers
        content, // message
        true, // silent
        callback, // callback
        options
      );
      await outgoingMessage.sendToNumber(pubKey);
    }
  }

  window.libloki.api = {
    sendFriendRequestAccepted,
    sendEmptyMessage,
    sendOnlineBroadcastMessage,
    broadcastOnlineStatus,
  };
})();
