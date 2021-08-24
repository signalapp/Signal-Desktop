// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global
  _,
  MessageController,
  Whisper
*/

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  async function destroyExpiredMessages() {
    try {
      window.log.info('destroyExpiredMessages: Loading messages...');
      const messages = await window.Signal.Data.getExpiredMessages({
        MessageCollection: Whisper.MessageCollection,
      });
      window.log.info(
        `destroyExpiredMessages: found ${messages.length} messages to expire`
      );

      const messageIds = [];
      const inMemoryMessages = [];
      const messageCleanup = [];

      messages.forEach(dbMessage => {
        const message = MessageController.register(dbMessage.id, dbMessage);
        messageIds.push(message.id);
        inMemoryMessages.push(message);
        messageCleanup.push(message.cleanup());
      });

      // We delete after the trigger to allow the conversation time to process
      //   the expiration before the message is removed from the database.
      await window.Signal.Data.removeMessages(messageIds);
      await Promise.all(messageCleanup);

      inMemoryMessages.forEach(message => {
        window.log.info('Message expired', {
          sentAt: message.get('sent_at'),
        });

        const conversation = message.getConversation();
        if (conversation) {
          // An expired message only counts as decrementing the message count, not
          // the sent message count
          conversation.decrementMessageCount();
        }
      });
    } catch (error) {
      window.log.error(
        'destroyExpiredMessages: Error deleting expired messages',
        error && error.stack ? error.stack : error
      );
    }

    window.log.info('destroyExpiredMessages: complete');
    checkExpiringMessages();
  }

  let timeout;
  async function checkExpiringMessages() {
    window.log.info('checkExpiringMessages: checking for expiring messages');

    const soonestExpiry = await window.Signal.Data.getSoonestMessageExpiry();
    if (!soonestExpiry) {
      window.log.info('checkExpiringMessages: found no messages to expire');
      return;
    }

    let wait = soonestExpiry - Date.now();

    // In the past
    if (wait < 0) {
      wait = 0;
    }

    // Too far in the future, since it's limited to a 32-bit value
    if (wait > 2147483647) {
      wait = 2147483647;
    }

    window.log.info(
      `checkExpiringMessages: next message expires ${new Date(
        soonestExpiry
      ).toISOString()}; waiting ${wait} ms before clearing`
    );

    clearTimeout(timeout);
    timeout = setTimeout(destroyExpiredMessages, wait);
  }
  const debouncedCheckExpiringMessages = _.debounce(
    checkExpiringMessages,
    1000
  );

  Whisper.ExpiringMessagesListener = {
    init(events) {
      checkExpiringMessages();
      events.on('timetravel', debouncedCheckExpiringMessages);
    },
    update: debouncedCheckExpiringMessages,
  };
})();
