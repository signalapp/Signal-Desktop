// Copyright 2016-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';

import type { MessageModel } from '../models/messages';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { sleep } from '../util/sleep';
import { SECOND } from '../util/durations';

class ExpiringMessagesDeletionService {
  public update: typeof this.checkExpiringMessages;

  private timeout?: ReturnType<typeof setTimeout>;

  constructor() {
    this.update = debounce(this.checkExpiringMessages, 1000);
  }

  private async destroyExpiredMessages() {
    try {
      window.SignalContext.log.info(
        'destroyExpiredMessages: Loading messages...'
      );
      const messages = await window.Signal.Data.getExpiredMessages();
      window.SignalContext.log.info(
        `destroyExpiredMessages: found ${messages.length} messages to expire`
      );

      const messageIds: Array<string> = [];
      const inMemoryMessages: Array<MessageModel> = [];
      const messageCleanup: Array<Promise<void>> = [];

      messages.forEach(dbMessage => {
        const message = window.MessageController.register(
          dbMessage.id,
          dbMessage
        );
        messageIds.push(message.id);
        inMemoryMessages.push(message);
        messageCleanup.push(message.cleanup());
      });

      // We delete after the trigger to allow the conversation time to process
      //   the expiration before the message is removed from the database.
      await window.Signal.Data.removeMessages(messageIds);
      await Promise.all(messageCleanup);

      inMemoryMessages.forEach(message => {
        window.SignalContext.log.info('Message expired', {
          sentAt: message.get('sent_at'),
        });

        const conversation = message.getConversation();

        // We do this to update the UI, if this message is being displayed somewhere
        message.trigger('expired');

        if (conversation) {
          // An expired message only counts as decrementing the message count, not
          // the sent message count
          conversation.decrementMessageCount();
        }
      });
    } catch (error) {
      window.SignalContext.log.error(
        'destroyExpiredMessages: Error deleting expired messages',
        error && error.stack ? error.stack : error
      );
      window.SignalContext.log.info(
        'destroyExpiredMessages: Waiting 30 seconds before trying again'
      );
      await sleep(30 * SECOND);
    }

    window.SignalContext.log.info(
      'destroyExpiredMessages: done, scheduling another check'
    );
    this.update();
  }

  private async checkExpiringMessages() {
    window.SignalContext.log.info(
      'checkExpiringMessages: checking for expiring messages'
    );

    const soonestExpiry = await window.Signal.Data.getSoonestMessageExpiry();
    if (!soonestExpiry) {
      window.SignalContext.log.info(
        'checkExpiringMessages: found no messages to expire'
      );
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

    window.SignalContext.log.info(
      `checkExpiringMessages: next message expires ${new Date(
        soonestExpiry
      ).toISOString()}; waiting ${wait} ms before clearing`
    );

    clearTimeoutIfNecessary(this.timeout);
    this.timeout = setTimeout(this.destroyExpiredMessages.bind(this), wait);
  }
}

export const expiringMessagesDeletionService =
  new ExpiringMessagesDeletionService();
