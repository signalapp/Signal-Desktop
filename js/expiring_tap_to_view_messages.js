// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global
  _,
  MessageController,
  Whisper
*/

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  async function eraseTapToViewMessages() {
    try {
      window.SignalContext.log.info(
        'eraseTapToViewMessages: Loading messages...'
      );
      const messages =
        await window.Signal.Data.getTapToViewMessagesNeedingErase({
          MessageCollection: Whisper.MessageCollection,
        });

      await Promise.all(
        messages.map(async fromDB => {
          const message = MessageController.register(fromDB.id, fromDB);

          window.SignalContext.log.info(
            'eraseTapToViewMessages: message data erased',
            message.idForLogging()
          );

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

  let timeout;
  async function checkTapToViewMessages() {
    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const THIRTY_DAYS = 30 * 24 * HOUR;

    const receivedAt =
      await window.Signal.Data.getNextTapToViewMessageTimestampToAgeOut();
    if (!receivedAt) {
      return;
    }

    const nextCheck = receivedAt + THIRTY_DAYS;

    Whisper.TapToViewMessagesListener.nextCheck = nextCheck;
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

    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      await eraseTapToViewMessages();
      checkTapToViewMessages();
    }, wait);
  }
  const debouncedCheckTapToViewMessages = _.debounce(
    checkTapToViewMessages,
    1000
  );

  Whisper.TapToViewMessagesListener = {
    nextCheck: null,
    init(events) {
      checkTapToViewMessages();
      events.on('timetravel', debouncedCheckTapToViewMessages);
    },
    update: debouncedCheckTapToViewMessages,
  };
})();
