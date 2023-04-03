import { throttle, uniq } from 'lodash';
import moment from 'moment';
import { messagesExpired } from '../state/ducks/conversations';
import { TimerOptionsArray } from '../state/ducks/timerOptions';
import { LocalizerKeys } from '../types/LocalizerKeys';
import { initWallClockListener } from './wallClockListener';

import { Data } from '../data/data';
import { getConversationController } from '../session/conversations';
import { getNowWithNetworkOffset } from '../session/apis/snode_api/SNodeAPI';
import { ProtobufUtils, SignalService } from '../protobuf';

// TODO Might need to be improved by using an enum
// TODO do we need to add legacy here now that it's explicitly in the protbuf?
export const DisappearingMessageMode = ['deleteAfterRead', 'deleteAfterSend'];
export type DisappearingMessageType = typeof DisappearingMessageMode[number] | null;

// TODO legacy messages support will be removed in a future release
export const DisappearingMessageConversationSetting = ['off', ...DisappearingMessageMode, 'legacy'];
export type DisappearingMessageConversationType = typeof DisappearingMessageConversationSetting[number];
export const DEFAULT_TIMER_OPTION = {
  PRIVATE_CONVERSATION: 86400, // 1 day
  GROUP: 43200, // 12 hours
};

export type DisappearingMessageUpdate = {
  expirationType: DisappearingMessageType;
  expirationTimer: number;
  // This is used for the expirationTimerUpdate
  lastDisappearingMessageChangeTimestamp?: number;
  isLegacyConversationSettingMessage?: boolean;
  isLegacyMessage?: boolean;
  isDisappearingMessagesV2Released?: boolean;
};

// TODO legacy messages support will be removed in a future release
// NOTE We need this to check for legacy disappearing messages where the expirationType and expireTimer should be undefined on the ContentMessage
function isLegacyContentMessage(contentMessage: SignalService.Content): boolean {
  return (
    (contentMessage.expirationType === SignalService.Content.ExpirationType.UNKNOWN ||
      !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationType')) &&
    !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationTimer')
  );
}

function isLegacyDataMessage(dataMessage: SignalService.DataMessage): boolean {
  return (
    ProtobufUtils.hasDefinedProperty(dataMessage, 'expireTimer') && dataMessage.expireTimer > -1
  );
}

export const DisappearingMessageUtils = {
  isLegacyContentMessage,
  isLegacyDataMessage,
};

export async function destroyMessagesAndUpdateRedux(
  messages: Array<{
    conversationKey: string;
    messageId: string;
  }>
) {
  if (!messages.length) {
    return;
  }
  const conversationWithChanges = uniq(messages.map(m => m.conversationKey));

  try {
    // Delete all those messages in a single sql call
    await Data.removeMessagesByIds(messages.map(m => m.messageId));
  } catch (e) {
    window.log.error('destroyMessages: removeMessagesByIds failed', e && e.message ? e.message : e);
  }
  // trigger a redux update if needed for all those messages
  window.inboxStore?.dispatch(messagesExpired(messages));

  // trigger a refresh the last message for all those uniq conversation
  conversationWithChanges.map(convoIdToUpdate => {
    getConversationController()
      .get(convoIdToUpdate)
      ?.updateLastMessage();
  });
}

async function destroyExpiredMessages() {
  try {
    window.log.info('destroyExpiredMessages: Loading messages...');
    const messages = await Data.getExpiredMessages();

    const messagesExpiredDetails: Array<{
      conversationKey: string;
      messageId: string;
    }> = messages.map(m => ({
      conversationKey: m.attributes.conversationId,
      messageId: m.id,
    }));

    messages.map(expired => {
      window.log.info('Message expired', {
        sentAt: expired.get('sent_at'),
      });
    });

    await destroyMessagesAndUpdateRedux(messagesExpiredDetails);
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
const throttledCheckExpiringMessages = throttle(checkExpiringMessages, 1000);

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
  { time: 2, unit: 'weeks' as moment.DurationInputArg2 },
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

export function setExpirationStartTimestamp(
  mode: DisappearingMessageType,
  timestamp?: number,
  isLegacyMode?: boolean
): number | undefined {
  let expirationStartTimestamp: number | undefined = getNowWithNetworkOffset();

  // TODO legacy messages support will be removed in a future release
  if (timestamp) {
    window.log.info(
      `WIP: We compare 2 timestamps for a disappear ${
        isLegacyMode ? 'legacy' : mode === 'deleteAfterRead' ? 'after read' : 'after send'
      } message: \expirationStartTimestamp `,
      new Date(expirationStartTimestamp).toLocaleTimeString(),
      '\ntimestamp ',
      new Date(timestamp).toLocaleTimeString()
    );
    expirationStartTimestamp = Math.min(expirationStartTimestamp, timestamp);
  }

  // TODO legacy messages support will be removed in a future release
  if (mode === 'deleteAfterRead') {
    window.log.info(
      `WIP: We set the start timestamp for a ${
        isLegacyMode ? 'legacy ' : ''
      }delete after read message to ${new Date(expirationStartTimestamp).toLocaleTimeString()}`
    );
  } else if (mode === 'deleteAfterSend') {
    window.log.info(
      `WIP: We set the start timestamp for a ${
        isLegacyMode ? 'legacy ' : ''
      }delete after send message to ${new Date(expirationStartTimestamp).toLocaleTimeString()}`
    );
  } else if (mode === 'off') {
    window.log.info(`WIP: Disappearing message mode "${mode}" set. We can safely ignore this.`);
    expirationStartTimestamp = undefined;
  } else {
    window.log.info(`WIP: Invalid disappearing message mode "${mode}" set. Ignoring`);
    expirationStartTimestamp = undefined;
  }

  return expirationStartTimestamp;
}
