// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  const messageLookup = Object.create(null);
  const msgIDsBySender = new Map();
  const msgIDsBySentAt = new Map();

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

    msgIDsBySentAt.set(message.get('sent_at'), id);
    msgIDsBySender.set(message.getSenderIdentifier(), id);

    return message;
  }

  function unregister(id) {
    const { message } = messageLookup[id] || {};
    if (message) {
      msgIDsBySender.delete(message.getSenderIdentifier());
      msgIDsBySentAt.delete(message.get('sent_at'));
    }
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
        unregister(message.id);
      }
    }
  }

  function getById(id) {
    const existing = messageLookup[id];
    return existing && existing.message ? existing.message : null;
  }

  function findBySentAt(sentAt) {
    const id = msgIDsBySentAt.get(sentAt);
    if (!id) {
      return null;
    }
    return getById(id);
  }

  function findBySender(sender) {
    const id = msgIDsBySender.get(sender);
    if (!id) {
      return null;
    }
    return getById(id);
  }

  function _get() {
    return messageLookup;
  }

  setInterval(cleanup, HOUR);

  window.MessageController = {
    register,
    unregister,
    cleanup,
    findBySender,
    findBySentAt,
    getById,
    _get,
  };
})();
