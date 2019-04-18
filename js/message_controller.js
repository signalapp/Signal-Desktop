// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const messageLookup = Object.create(null);

  const SECOND = 1000;
  const MINUTE = SECOND * 60;
  const FIVE_MINUTES = MINUTE * 5;
  const HOUR = MINUTE * 60;

  function register(id, message) {
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

  function _get() {
    return messageLookup;
  }

  setInterval(cleanup, HOUR);

  window.MessageController = {
    register,
    unregister,
    cleanup,
    _get,
  };
})();
