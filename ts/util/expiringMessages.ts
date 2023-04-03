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
import { ConversationModel } from '../models/conversation';
import { checkIsFeatureReleased } from './releaseFeature';
import { MessageModel } from '../models/message';

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
  // TODO legacy messages support will be removed in a future release
  isLegacyConversationSettingMessage?: boolean;
  isLegacyDataMessage?: boolean;
  isDisappearingMessagesV2Released?: boolean;
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

// TODO legacy messages support will be removed in a future release
// NOTE We need this to check for legacy disappearing messages where the expirationType and expireTimer should be undefined on the ContentMessage
function checkIsLegacyContentMessage(contentMessage: SignalService.Content): boolean {
  return (
    (contentMessage.expirationType === SignalService.Content.ExpirationType.UNKNOWN ||
      !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationType')) &&
    !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationTimer')
  );
}

function checkIsLegacyDataMessage(dataMessage: SignalService.DataMessage): boolean {
  return (
    ProtobufUtils.hasDefinedProperty(dataMessage, 'expireTimer') && dataMessage.expireTimer > -1
  );
}

// TODO legacy messages support will be removed in a future release
export async function checkForExpireUpdate(
  convoToUpdate: ConversationModel,
  content: SignalService.Content
): Promise<DisappearingMessageUpdate | undefined> {
  // debugger;
  const dataMessage = content.dataMessage as SignalService.DataMessage;
  // We will only support legacy disappearing messages for a short period before disappearing messages v2 is unlocked
  const isDisappearingMessagesV2Released = await checkIsFeatureReleased('Disappearing Messages V2');

  const isLegacyContentMessage = checkIsLegacyContentMessage(content);
  const isLegacyDataMessage = Boolean(
    isLegacyContentMessage && checkIsLegacyDataMessage(dataMessage as SignalService.DataMessage)
  );
  const isLegacyConversationSettingMessage =
    isLegacyContentMessage &&
    isLegacyDataMessage &&
    dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

  let expirationTimer = isLegacyDataMessage
    ? Number(dataMessage.expireTimer)
    : content.expirationTimer;
  let expirationType =
    expirationTimer > 0
      ? DisappearingMessageConversationSetting[
          !isDisappearingMessagesV2Released || isLegacyContentMessage ? 3 : content.expirationType
        ]
      : DisappearingMessageConversationSetting[0];
  const lastDisappearingMessageChangeTimestamp = content.lastDisappearingMessageChangeTimestamp
    ? Number(content.lastDisappearingMessageChangeTimestamp)
    : undefined;

  const shouldDisappearButIsntMessage =
    dataMessage.flags !== SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE &&
    expirationType === 'off' &&
    expirationTimer === 0 &&
    convoToUpdate.get('expirationType') !== 'off' &&
    convoToUpdate.get('expireTimer') !== 0;

  // If it is a legacy message and disappearing messages v2 is released then we ignore it and use the local client's conversation settings
  if (
    isDisappearingMessagesV2Released &&
    (isLegacyDataMessage || isLegacyConversationSettingMessage || shouldDisappearButIsntMessage)
  ) {
    window.log.info(`WIP: received a legacy disappearing message after v2 was released.`);
    expirationType = convoToUpdate.get('expirationType');
    expirationTimer = convoToUpdate.get('expireTimer');
  }

  const expireUpdate: DisappearingMessageUpdate = {
    expirationType,
    expirationTimer,
    lastDisappearingMessageChangeTimestamp,
    isLegacyConversationSettingMessage,
    isLegacyDataMessage,
    isDisappearingMessagesV2Released,
  };

  window.log.info(`WIP: checkForExpireUpdate`, expireUpdate);

  return expireUpdate;
}

// TODO legacy messages support will be removed in a future release
export function handleExpireUpdate(
  converationModel: ConversationModel,
  messageModel: MessageModel,
  expireUpdate: DisappearingMessageUpdate
) {
  let {
    expirationType,
    // TODO renamed expireTimer to expirationTimer
    expirationTimer: expireTimer,
    lastDisappearingMessageChangeTimestamp,
    isLegacyConversationSettingMessage,
    isDisappearingMessagesV2Released,
  } = expireUpdate;

  messageModel.set({
    expirationType,
    expireTimer,
  });

  // This message is conversation setting change message
  if (lastDisappearingMessageChangeTimestamp || isLegacyConversationSettingMessage) {
    const expirationTimerUpdate = {
      expirationType,
      expireTimer,
      lastDisappearingMessageChangeTimestamp: isLegacyConversationSettingMessage
        ? isDisappearingMessagesV2Released
          ? converationModel.get('lastDisappearingMessageChangeTimestamp')
          : Date.now()
        : Number(lastDisappearingMessageChangeTimestamp),
      source: messageModel.get('source'),
    };

    messageModel.set({
      expirationTimerUpdate,
    });
  }

  return messageModel;
}

export function checkHasOutdatedClient(
  convoToUpdate: ConversationModel,
  sender: ConversationModel,
  expireUpdate: DisappearingMessageUpdate
) {
  const outdatedSender =
    sender.get('nickname') || sender.get('displayNameInProfile') || sender.get('id');

  if (convoToUpdate.get('hasOutdatedClient')) {
    // trigger notice banner
    if (expireUpdate.isLegacyDataMessage || expireUpdate.isLegacyConversationSettingMessage) {
      if (convoToUpdate.get('hasOutdatedClient') !== outdatedSender) {
        convoToUpdate.set({
          hasOutdatedClient: outdatedSender,
        });
      }
    } else {
      convoToUpdate.set({
        hasOutdatedClient: undefined,
      });
    }
    convoToUpdate.commit();
  } else {
    if (expireUpdate.isLegacyDataMessage || expireUpdate.isLegacyConversationSettingMessage) {
      convoToUpdate.set({
        hasOutdatedClient: outdatedSender,
      });
      convoToUpdate.commit();
    }
  }
}
