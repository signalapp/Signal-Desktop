// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { DAY } from '../util/durations';

async function eraseTapToViewMessages() {
  try {
    window.SignalContext.log.info(
      'eraseTapToViewMessages: Loading messages...'
    );
    const messages =
      await window.Signal.Data.getTapToViewMessagesNeedingErase();
    await Promise.all(
      messages.map(async fromDB => {
        const message = window.MessageController.register(fromDB.id, fromDB);

        window.SignalContext.log.info(
          'eraseTapToViewMessages: erasing message contents',
          message.idForLogging()
        );

        // We do this to update the UI, if this message is being displayed somewhere
        message.trigger('expired');

        await message.eraseContents();
      })
    );
  } catch (error) {
    window.SignalContext.log.error(
      'eraseTapToViewMessages: Error erasing messages',
      error && error.stack ? error.stack : error
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
    const receivedAt =
      await window.Signal.Data.getNextTapToViewMessageTimestampToAgeOut();
    if (!receivedAt) {
      return;
    }

    const nextCheck = receivedAt + 30 * DAY;
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
      this.update();
    }, wait);
  }
}

export const tapToViewMessagesDeletionService =
  new TapToViewMessagesDeletionService();
