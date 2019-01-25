/* global window, textsecure, log */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  async function sendFriendRequestAccepted(pubKey) {
    return sendEmptyMessage(pubKey, true);
  }

  async function broadcastOnlineStatus() {
    const friendKeys = await window.Signal.Data.getPubKeysWithFriendStatus(
      friendRequestStatusEnum.friends
    );
    friendKeys.forEach(pubKey => {
      sendOnlineBroadcastMessage(pubKey);
    });
  }

  async function sendOnlineBroadcastMessage(pubKey) {
    const onlineBroadcastMessage = new textsecure.protobuf.OnlineBroadcastMessage(
      {
        p2pAddress: 'testAddress',
        p2pPort: parseInt(window.localServerPort, 10),
      }
    );
    const content = new textsecure.protobuf.Content({
      onlineBroadcastMessage,
    });

    // will be called once the transmission succeeded or failed
    const callback = res => {
      if (res.errors.length > 0) {
        res.errors.forEach(error => log.error(error));
      } else {
        log.info('Online broadcast message sent successfully');
      }
    };
    const options = { messageType: 'onlineBroadcast' };
    // Send a empty message with information about how to contact us directly
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

  // Possible conversation friend states
  const friendRequestStatusEnum = Object.freeze({
    // New conversation, no messages sent or received
    none: 0,
    // This state is used to lock the input early while sending
    pendingSend: 1,
    // Friend request sent, awaiting response
    requestSent: 2,
    // Friend request received, awaiting user input
    requestReceived: 3,
    // We did it!
    friends: 4,
  });

  window.libloki.api = {
    sendFriendRequestAccepted,
    sendEmptyMessage,
    sendOnlineBroadcastMessage,
    broadcastOnlineStatus,
  };

  window.libloki.friends = {
    friendRequestStatusEnum,
  };
})();
