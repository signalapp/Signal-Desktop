// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';
import { DataReader } from '../sql/Client';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { getMessageQueueTime } from '../util/getMessageQueueTime';
import * as Errors from '../types/errors';
import { strictAssert } from '../util/assert';
import { toBoundedDate } from '../util/timestamp';
import { getMessageIdForLogging } from '../util/idForLogging';
import { eraseMessageContents } from '../util/cleanup';
import { drop } from '../util/drop';
import { MessageModel } from '../models/messages';
import { createLogger } from '../logging/log';

const log = createLogger('tapToViewMessagesDeletionService');

async function eraseTapToViewMessages() {
  try {
    log.info('eraseTapToViewMessages: Loading messages...');
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

        const message = window.MessageCache.register(new MessageModel(fromDB));

        log.info(
          'eraseTapToViewMessages: erasing message contents',
          getMessageIdForLogging(message.attributes)
        );

        // We do this to update the UI, if this message is being displayed somewhere
        window.reduxActions.conversations.messageExpired(message.id);

        await eraseMessageContents(message);
      })
    );
  } catch (error) {
    log.error(
      'eraseTapToViewMessages: Error erasing messages',
      Errors.toLogFormat(error)
    );
  }

  log.info('eraseTapToViewMessages: complete');
}

class TapToViewMessagesDeletionService {
  #timeout?: ReturnType<typeof setTimeout>;
  #isPaused = false;
  #debouncedUpdate = debounce(this.#checkTapToViewMessages);

  update() {
    drop(this.#debouncedUpdate());
  }

  pause(): void {
    if (this.#isPaused) {
      log.warn('checkTapToViewMessages: already paused');
      return;
    }

    log.info('checkTapToViewMessages: pause');

    this.#isPaused = true;
    clearTimeoutIfNecessary(this.#timeout);
    this.#timeout = undefined;
  }

  resume(): void {
    if (!this.#isPaused) {
      log.warn('checkTapToViewMessages: not paused');
      return;
    }

    log.info('checkTapToViewMessages: resuming');
    this.#isPaused = false;

    this.#debouncedUpdate.cancel();
    this.update();
  }

  async #checkTapToViewMessages() {
    if (!this.#shouldRun()) {
      log.info('checkTapToViewMessages: not running');
      return;
    }

    const receivedAtMsForOldestTapToViewMessage =
      await DataReader.getNextTapToViewMessageTimestampToAgeOut();
    if (!receivedAtMsForOldestTapToViewMessage) {
      return;
    }

    const nextCheck =
      receivedAtMsForOldestTapToViewMessage + getMessageQueueTime();
    log.info(
      'checkTapToViewMessages: next check at',
      toBoundedDate(nextCheck).toISOString()
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

    clearTimeoutIfNecessary(this.#timeout);
    this.#timeout = setTimeout(async () => {
      if (!this.#shouldRun()) {
        log.info('checkTapToViewMessages: not running');
        return;
      }

      await eraseTapToViewMessages();
      this.update();
    }, wait);
  }

  #shouldRun(): boolean {
    return !this.#isPaused && !window.SignalContext.isTestOrMockEnvironment();
  }
}

export const tapToViewMessagesDeletionService =
  new TapToViewMessagesDeletionService();
