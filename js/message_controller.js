// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  const messageLookup = Object.create(null);

  const SECOND = 1000;
  const MINUTE = SECOND * 60;
  const FIVE_MINUTES = MINUTE * 5;
  const HOUR = MINUTE * 60;

  function register(id, message) {
    if (!id || !message) {
      return message;
    }

    const existing = messageLookup[id];
    if (existing) {
      messageLookup[id] = {
        message: existing.message,
        timestamp: Date.now(),
      };
      return existing.message;
    }

    messageLookup[id] = {
      message,
      timestamp: Date.now(),
    };

    return message;
  }

  function unregister(id) {
    delete messageLookup[id];
  }

  function cleanup() {
    const messages = Object.values(messageLookup);
    const now = Date.now();

    for (let i = 0, max = messages.length; i < max; i += 1) {
      const { message, timestamp } = messages[i];
      const conversation = message.getConversation();

      if (
        now - timestamp > FIVE_MINUTES &&
        (!conversation || !conversation.messageCollection.length)
      ) {
        delete messageLookup[message.id];
      }
    }
  }

  function getById(id) {
    const existing = messageLookup[id];
    return existing && existing.message ? existing.message : null;
  }

  function _get() {
    return messageLookup;
  }

  setInterval(cleanup, HOUR);

  window.MessageController = {
    register,
    unregister,
    cleanup,
    getById,
    _get,
  };
})();
