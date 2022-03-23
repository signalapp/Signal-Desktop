import _ from 'lodash';
import moment from 'moment';
import { MessageModel } from '../models/message';
import { messageExpired } from '../state/ducks/conversations';
import { TimerOptionsArray } from '../state/ducks/timerOptions';
import { LocalizerKeys } from '../types/LocalizerKeys';
import { initWallClockListener } from './wallClockListener';

import * as Data from '../data/data';

async function destroyExpiredMessages() {
  try {
    window.log.info('destroyExpiredMessages: Loading messages...');
    const messages = await Data.getExpiredMessages();

    await Promise.all(
      messages.map(async (message: MessageModel) => {
        window.log.info('Message expired', {
          sentAt: message.get('sent_at'),
        });

        // We delete after the trigger to allow the conversation time to process
        //   the expiration before the message is removed from the database.
        await Data.removeMessage(message.id);

        // trigger the expiration of the message on the redux itself.
        window.inboxStore?.dispatch(
          messageExpired({
            conversationKey: message.attributes.conversationId,
            messageId: message.id,
          })
        );

        const conversation = message.getConversation();
        if (conversation) {
          await conversation.onExpired(message);
        }
      })
    );
  } catch (error) {
    window.log.error(
      'destroyExpiredMessages: Error deleting expired messages',
      error && error.stack ? error.stack : error
    );
  }

  window.log.info('destroyExpiredMessages: complete');
  void checkExpiringMessages();
}

let timeout: NodeJS.Timeout | undefined;
async function checkExpiringMessages() {
  // Look up the next expiring message and set a timer to destroy it
  const messages = await Data.getNextExpiringMessage();
  const next = messages.at(0);
  if (!next) {
    return;
  }

  const expiresAt = next.get('expires_at');
  if (!expiresAt) {
    return;
  }
  window.log.info('next message expires', new Date(expiresAt).toISOString());
  window.log.info('next message expires in ', (expiresAt - Date.now()) / 1000);

  let wait = expiresAt - Date.now();

  // In the past
  if (wait < 0) {
    wait = 0;
  }

  // Too far in the future, since it's limited to a 32-bit value
  if (wait > 2147483647) {
    wait = 2147483647;
  }

  if (timeout) {
    global.clearTimeout(timeout);
  }
  timeout = global.setTimeout(destroyExpiredMessages, wait);
}
const throttledCheckExpiringMessages = _.throttle(checkExpiringMessages, 1000);

let isInit = false;

const initExpiringMessageListener = () => {
  if (isInit) {
    throw new Error('expiring messages listener is already init');
  }

  void checkExpiringMessages();

  initWallClockListener(throttledCheckExpiringMessages);
  isInit = true;
};

const updateExpiringMessagesCheck = () => {
  void throttledCheckExpiringMessages();
};

function getTimerOptionName(time: number, unit: moment.DurationInputArg2) {
  return (
    window.i18n(['timerOption', time, unit].join('_') as LocalizerKeys) ||
    moment.duration(time, unit).humanize()
  );
}
function getTimerOptionAbbreviated(time: number, unit: string) {
  return window.i18n(['timerOption', time, unit, 'abbreviated'].join('_') as LocalizerKeys);
}

const timerOptionsDurations: Array<{
  time: number;
  unit: moment.DurationInputArg2;
  seconds: number;
}> = [
  { time: 0, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 5, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 10, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 30, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 1, unit: 'minute' as moment.DurationInputArg2 },
  { time: 5, unit: 'minutes' as moment.DurationInputArg2 },
  { time: 30, unit: 'minutes' as moment.DurationInputArg2 },
  { time: 1, unit: 'hour' as moment.DurationInputArg2 },
  { time: 6, unit: 'hours' as moment.DurationInputArg2 },
  { time: 12, unit: 'hours' as moment.DurationInputArg2 },
  { time: 1, unit: 'day' as moment.DurationInputArg2 },
  { time: 1, unit: 'week' as moment.DurationInputArg2 },
].map(o => {
  const duration = moment.duration(o.time, o.unit); // 5, 'seconds'
  return {
    time: o.time,
    unit: o.unit,
    seconds: duration.asSeconds(),
  };
});

function getName(seconds = 0) {
  const o = timerOptionsDurations.find(m => m.seconds === seconds);

  if (o) {
    return getTimerOptionName(o.time, o.unit);
  }
  return [seconds, 'seconds'].join(' ');
}
function getAbbreviated(seconds = 0) {
  const o = timerOptionsDurations.find(m => m.seconds === seconds);

  if (o) {
    return getTimerOptionAbbreviated(o.time, o.unit);
  }

  return [seconds, 's'].join('');
}

function getTimerSecondsWithName(): TimerOptionsArray {
  return timerOptionsDurations.map(t => {
    return { name: getName(t.seconds), value: t.seconds };
  });
}

export const ExpirationTimerOptions = {
  getName,
  getAbbreviated,
  updateExpiringMessagesCheck,
  initExpiringMessageListener,
  getTimerSecondsWithName,
};
