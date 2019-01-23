/* global window, textsecure */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  async function sendFriendRequestAccepted(pubKey) {
    return sendEmptyMessage(pubKey);
  }

  async function sendEmptyMessage(pubKey) {
    const options = {};
    // send an empty message.
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
  }

  window.libloki.api = {
    sendFriendRequestAccepted,
    sendEmptyMessage,
  };
})();
