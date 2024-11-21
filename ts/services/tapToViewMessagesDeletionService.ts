// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';
import { DataReader } from '../sql/Client';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { getMessageQueueTime } from '../util/getMessageQueueTime';
import * as Errors from '../types/errors';
import { strictAssert } from '../util/assert';

async function eraseTapToViewMessages() {
  try {
    window.SignalContext.log.info(
      'eraseTapToViewMessages: Loading messages...'
    );
    const maxTimestamp = Date.now() - getMessageQueueTime();
    const messages =
      await DataReader.getTapToViewMessagesNeedingErase(maxTimestamp);

    await Promise.all(
      messages.map(async fromDB => {
        strictAssert(fromDB.isViewOnce === true, 'Must be view once');
        strictAssert(
          (fromDB.received_at_ms ?? 0) <= maxTimestamp,
          'Must be older than maxTimestamp'
        );

        const message = window.MessageCache.__DEPRECATED$register(
          fromDB.id,
          fromDB,
          'eraseTapToViewMessages'
        );

        window.SignalContext.log.info(
          'eraseTapToViewMessages: erasing message contents',
          message.idForLogging()
        );

        // We do this to update the UI, if this message is being displayed somewhere
        message.trigger('expired');
        window.reduxActions.conversations.messageExpired(message.id);

        await message.eraseContents();
      })
    );
  } catch (error) {
    window.SignalContext.log.error(
      'eraseTapToViewMessages: Error erasing messages',
      Errors.toLogFormat(error)
    );
  }

  window.SignalContext.log.info('eraseTapToViewMessages: complete');
}

class TapToViewMessagesDeletionService {
  public update: typeof this.checkTapToViewMessages;

  private timeout?: ReturnType<typeof setTimeout>;

  constructor() {
    this.update = debounce(this.checkTapToViewMessages, 1000);
  }

  private async checkTapToViewMessages() {
    const receivedAtMsForOldestTapToViewMessage =
      await DataReader.getNextTapToViewMessageTimestampToAgeOut();
    if (!receivedAtMsForOldestTapToViewMessage) {
      return;
    }

    const nextCheck =
      receivedAtMsForOldestTapToViewMessage + getMessageQueueTime();
    window.SignalContext.log.info(
      'checkTapToViewMessages: next check at',
      new Date(nextCheck).toISOString()
    );

    let wait = nextCheck - Date.now();

    // In the past
    if (wait < 0) {
      wait = 0;
    }

    // Too far in the future, since it's limited to a 32-bit value
    if (wait > 2147483647) {
      wait = 2147483647;
    }

    clearTimeoutIfNecessary(this.timeout);
    this.timeout = setTimeout(async () => {
      await eraseTapToViewMessages();
      void this.update();
    }, wait);
  }
}

export const tapToViewMessagesDeletionService =
  new TapToViewMessagesDeletionService();
