/* global
  _,
  MessageController,
  Whisper
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  async function eraseTapToViewMessages() {
    try {
      window.log.info('eraseTapToViewMessages: Loading messages...');
      const messages = await window.Signal.Data.getTapToViewMessagesNeedingErase(
        {
          MessageCollection: Whisper.MessageCollection,
        }
      );

      await Promise.all(
        messages.map(async fromDB => {
          const message = MessageController.register(fromDB.id, fromDB);

          window.log.info(
            'eraseTapToViewMessages: message data erased',
            message.idForLogging()
          );

          message.trigger('erased');
          await message.eraseContents();
        })
      );
    } catch (error) {
      window.log.error(
        'eraseTapToViewMessages: Error erasing messages',
        error && error.stack ? error.stack : error
      );
    }

    window.log.info('eraseTapToViewMessages: complete');
  }

  let timeout;
  async function checkTapToViewMessages() {
    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const THIRTY_DAYS = 30 * 24 * HOUR;

    const toAgeOut = await window.Signal.Data.getNextTapToViewMessageToAgeOut({
      Message: Whisper.Message,
    });
    const toExpire = await window.Signal.Data.getNextTapToViewMessageToExpire({
      Message: Whisper.Message,
    });

    if (!toAgeOut && !toExpire) {
      return;
    }

    const ageOutAt = toAgeOut
      ? toAgeOut.get('received_at') + THIRTY_DAYS
      : Number.MAX_VALUE;
    const expireAt = toExpire
      ? toExpire.get('messageTimerExpiresAt')
      : Number.MAX_VALUE;

    const nextCheck = Math.min(ageOutAt, expireAt);

    Whisper.TapToViewMessagesListener.nextCheck = nextCheck;
    window.log.info(
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
  const throttledCheckTapToViewMessages = _.throttle(
    checkTapToViewMessages,
    1000
  );

  Whisper.TapToViewMessagesListener = {
    nextCheck: null,
    init(events) {
      checkTapToViewMessages();
      events.on('timetravel', throttledCheckTapToViewMessages);
    },
    update: throttledCheckTapToViewMessages,
  };
})();
