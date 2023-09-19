import { throttle, uniq } from 'lodash';
import moment from 'moment';
import { messagesExpired } from '../state/ducks/conversations';
import { TimerOptionsArray } from '../state/ducks/timerOptions';
import { LocalizerKeys } from '../types/LocalizerKeys';
import { initWallClockListener } from './wallClockListener';

import { Data } from '../data/data';
import { getConversationController } from '../session/conversations';
import { ProtobufUtils, SignalService } from '../protobuf';
import { ConversationModel } from '../models/conversation';
import { MessageModel } from '../models/message';
import { GetNetworkTime } from '../session/apis/snode_api/getNetworkTime';
import { ReleasedFeatures } from './releaseFeature';

// NOTE this must match Content.ExpirationType in the protobuf
// TODO double check this
export const DisappearingMessageMode = ['unknown', 'deleteAfterRead', 'deleteAfterSend'] as const;
export type DisappearingMessageType = typeof DisappearingMessageMode[number];
export type DisappearAfterSendOnly = Exclude<DisappearingMessageType, 'deleteAfterRead'>;
// NOTE these cannot be imported in the nodejs side yet. We need to move the types to the own file with no window imports
// TODO legacy messages support will be removed in a future release
// TODO NOTE legacy is strictly used in the UI and is not a valid disappearing message mode
export const DisappearingMessageConversationSetting = [
  'off',
  DisappearingMessageMode[1], // deleteAfterRead
  DisappearingMessageMode[2], // deleteAfterSend
  'legacy',
] as const;
export type DisappearingMessageConversationType = typeof DisappearingMessageConversationSetting[number]; // TODO we should make this type a bit more hardcoded than being just resolved as a string

export const DEFAULT_TIMER_OPTION = {
  DELETE_AFTER_READ: 43200, // 12 hours
  DELETE_AFTER_SEND: 86400, // 1 day
  LEGACY: 86400, // 1 day
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
  shouldDisappearButIsntMessage?: boolean;
  isOutdated?: boolean;
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
    const messageIds = messages.map(m => m.messageId);

    // Delete any attachments
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < messageIds.length; i++) {
      /* eslint-disable no-await-in-loop */
      const message = await Data.getMessageById(messageIds[i]);
      await message?.cleanup();
      /* eslint-enable no-await-in-loop */
    }

    // Delete all those messages in a single sql call
    await Data.removeMessagesByIds(messageIds);
  } catch (e) {
    window.log.error('destroyMessages: removeMessagesByIds failed', e && e.message ? e.message : e);
  }
  // trigger a redux update if needed for all those messages
  window.inboxStore?.dispatch(messagesExpired(messages));

  // trigger a refresh the last message for all those uniq conversation
  conversationWithChanges.forEach(convoIdToUpdate => {
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
      conversationKey: m.get('conversationId'),
      messageId: m.id,
    }));

    messages.forEach(expired => {
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
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  timeout = global.setTimeout(async () => destroyExpiredMessages(), wait);
}
const throttledCheckExpiringMessages = throttle(checkExpiringMessages, 1000);

let isInit = false;

const initExpiringMessageListener = () => {
  if (isInit) {
    throw new Error('expiring messages listener is already init');
  }

  void checkExpiringMessages();

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  initWallClockListener(async () => throttledCheckExpiringMessages());
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
  mode: DisappearingMessageConversationType,
  timestamp?: number
): number | undefined {
  let expirationStartTimestamp: number | undefined = GetNetworkTime.getNowWithNetworkOffset();

  // TODO legacy messages support will be removed in a future release
  if (timestamp) {
    window.log.debug(
      `WIP: We compare 2 timestamps for a disappearing message (${mode}): expirationStartTimestamp `,
      new Date(expirationStartTimestamp).toLocaleTimeString(),
      '\ntimestamp ',
      new Date(timestamp).toLocaleTimeString()
    );
    expirationStartTimestamp = Math.min(expirationStartTimestamp, timestamp);
  }

  // TODO legacy messages support will be removed in a future release
  if (mode === 'deleteAfterRead') {
    window.log.debug(
      `WIP: We set the start timestamp for a delete after read message to ${new Date(
        expirationStartTimestamp
      ).toLocaleTimeString()}`
    );
  } else if (mode === 'deleteAfterSend') {
    window.log.debug(
      `WIP: We set the start timestamp for a delete after send message to ${new Date(
        expirationStartTimestamp
      ).toLocaleTimeString()}`
    );
    // TODO needs improvement
  } else if (mode === 'legacy') {
    window.log.debug(
      `WIP: We set the start timestamp for a legacy message to ${new Date(
        expirationStartTimestamp
      ).toLocaleTimeString()}`
    );
  } else if (mode === 'off') {
    window.log.debug('Disappearing message mode has been turned off. We can safely ignore this.');
    expirationStartTimestamp = undefined;
  } else {
    window.log.debug(`WIP: Invalid disappearing message mode "${mode}" set. Ignoring`);
    expirationStartTimestamp = undefined;
  }

  return expirationStartTimestamp;
}

// TODO legacy messages support will be removed in a future release
export function isLegacyDisappearingModeEnabled(
  expirationType: DisappearingMessageConversationType | DisappearingMessageType | undefined
): boolean {
  return Boolean(
    expirationType &&
      expirationType !== 'off' &&
      !ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()
  );
}

// TODO legacy messages support will be removed in a future release
/**
 * Converts DisappearingMessageConversationType to DisappearingMessageType
 *
 * NOTE Used for sending or receiving data messages (protobuf)
 *
 * @param convo Conversation we want to set
 * @param expirationType DisappearingMessageConversationType
 * @returns Disappearing mode we should use
 */
export function changeToDisappearingMessageType(
  convo: ConversationModel,
  expireTimer: number,
  expirationType?: DisappearingMessageConversationType
): DisappearingMessageType {
  if (expirationType === 'off' || expirationType === 'legacy') {
    // NOTE we would want this to be undefined but because of an issue with the protobuf implement we need to have a value
    return 'unknown';
  }

  if (expireTimer > 0) {
    if (convo.isMe() || convo.isClosedGroup()) {
      return 'deleteAfterSend';
    }

    return expirationType === 'deleteAfterSend' ? 'deleteAfterSend' : 'deleteAfterRead';
  }

  return 'unknown';
}

// TODO legacy messages support will be removed in a future release
/**
 * Converts DisappearingMessageType to DisappearingMessageConversationType
 *
 * NOTE Used for the UI
 *
 * @param convo  Conversation we want to set
 * @param expirationType DisappearingMessageType
 * @param expireTimer
 * @returns
 */
export function changeToDisappearingMessageConversationType(
  convo: ConversationModel,
  expirationType?: DisappearingMessageType,
  expireTimer?: number
): DisappearingMessageConversationType {
  if (!expirationType || expirationType === 'unknown') {
    return expireTimer && expireTimer > 0 ? 'legacy' : 'off';
  }

  if (convo.isMe() || convo.isClosedGroup()) {
    return 'deleteAfterSend';
  }

  return expirationType === 'deleteAfterSend' ? 'deleteAfterSend' : 'deleteAfterRead';
}

// TODO legacy messages support will be removed in a future release
// NOTE We need this to check for legacy disappearing messages where the expirationType and expireTimer should be undefined on the ContentMessage
function couldBeLegacyDisappearingMessageContent(contentMessage: SignalService.Content): boolean {
  return (
    (contentMessage.expirationType === SignalService.Content.ExpirationType.UNKNOWN ||
      (ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached() &&
        !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationType'))) &&
    !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationTimer')
  );
}

/**
 * Checks if a message is meant to disappear but doesn't have the correct expiration values set
 *
 * NOTE Examples: legacy disappearing message conversation settings, synced messages from legacy devices
 */
function checkDisappearButIsntMessage(
  content: SignalService.Content,
  convo: ConversationModel,
  expirationMode: DisappearingMessageConversationType,
  expirationTimer: number
): boolean {
  return (
    content.dataMessage?.flags !== SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE &&
    expirationMode === 'off' &&
    expirationTimer === 0 &&
    convo.get('expirationType') !== 'off' &&
    convo.get('expireTimer') !== 0
  );
}

export function checkIsLegacyDisappearingDataMessage(
  couldBeLegacyContent: boolean,
  dataMessage: SignalService.DataMessage
): boolean {
  return (
    couldBeLegacyContent &&
    ProtobufUtils.hasDefinedProperty(dataMessage, 'expireTimer') &&
    dataMessage.expireTimer > -1
  );
}

// TODO legacy messages support will be removed in a future release
export async function checkForExpireUpdateInContentMessage(
  content: SignalService.Content,
  convoToUpdate: ConversationModel
): Promise<DisappearingMessageUpdate | undefined> {
  const dataMessage = content.dataMessage as SignalService.DataMessage;
  // We will only support legacy disappearing messages for a short period before disappearing messages v2 is unlocked
  const isDisappearingMessagesV2Released = await ReleasedFeatures.checkIsDisappearMessageV2FeatureReleased();

  const couldBeLegacyContentMessage = couldBeLegacyDisappearingMessageContent(content);
  const isLegacyDataMessage = checkIsLegacyDisappearingDataMessage(
    couldBeLegacyContentMessage,
    dataMessage as SignalService.DataMessage
  );
  const isLegacyConversationSettingMessage = isDisappearingMessagesV2Released
    ? (isLegacyDataMessage ||
        (couldBeLegacyContentMessage && !content.lastDisappearingMessageChangeTimestamp)) &&
      dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE
    : couldBeLegacyContentMessage &&
      dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

  const expirationTimer = isLegacyDataMessage
    ? Number(dataMessage.expireTimer)
    : content.expirationTimer;

  // NOTE we don't use the expirationType directly from the Content Message because we need to resolve it to the correct convo type first in case it is legacy or has errors
  const expirationMode = changeToDisappearingMessageConversationType(
    convoToUpdate,
    DisappearingMessageMode[content.expirationType],
    expirationTimer
  );

  const lastDisappearingMessageChangeTimestamp = content.lastDisappearingMessageChangeTimestamp
    ? Number(content.lastDisappearingMessageChangeTimestamp)
    : undefined;

  if (
    convoToUpdate.get('lastDisappearingMessageChangeTimestamp') &&
    lastDisappearingMessageChangeTimestamp &&
    convoToUpdate.get('lastDisappearingMessageChangeTimestamp') >=
      lastDisappearingMessageChangeTimestamp
  ) {
    // window.log.info(
    //   `WIP: checkForExpireUpdateInContentMessage() This is an outdated disappearing message setting. So we will ignore it.\ncontent: ${JSON.stringify(
    //     content
    //   )}
    // );

    return {
      expirationType: changeToDisappearingMessageType(
        convoToUpdate,
        expirationTimer,
        expirationMode
      ),
      expirationTimer,
      isOutdated: true,
    };
  }

  const shouldDisappearButIsntMessage = checkDisappearButIsntMessage(
    content,
    convoToUpdate,
    expirationMode,
    expirationTimer
  );

  const expireUpdate: DisappearingMessageUpdate = {
    expirationType: changeToDisappearingMessageType(convoToUpdate, expirationTimer, expirationMode),
    expirationTimer,
    lastDisappearingMessageChangeTimestamp,
    isLegacyConversationSettingMessage,
    isLegacyDataMessage,
    isDisappearingMessagesV2Released,
    shouldDisappearButIsntMessage,
  };

  // NOTE some platforms do not include the diappearing message values in the Data Message for sent messages so we have to trust the conversation settings until v2 is released
  if (
    !isDisappearingMessagesV2Released &&
    !isLegacyConversationSettingMessage &&
    couldBeLegacyContentMessage &&
    convoToUpdate.get('expirationType') !== 'off'
  ) {
    if (
      expirationMode !== convoToUpdate.get('expirationType') ||
      expirationTimer !== convoToUpdate.get('expireTimer')
    ) {
      window.log.debug(
        `WIP: Received a legacy disappearing message before v2 was released without values set. Using the conversation settings.\ncontent: ${JSON.stringify(
          content
        )}\n\nconvoToUpdate: ${JSON.stringify(convoToUpdate)}`
      );

      expireUpdate.expirationTimer = convoToUpdate.get('expireTimer');
      expireUpdate.expirationType = changeToDisappearingMessageType(
        convoToUpdate,
        expireUpdate.expirationTimer,
        convoToUpdate.get('expirationType')
      );
      expireUpdate.isLegacyDataMessage = true;
    }
  }

  // NOTE If it is a legacy message and disappearing messages v2 is released then we ignore it and use the local client's conversation settings and show the outdated client banner
  if (
    isDisappearingMessagesV2Released &&
    (isLegacyDataMessage || isLegacyConversationSettingMessage || shouldDisappearButIsntMessage)
  ) {
    window.log.debug(
      `WIP: Received a legacy disappearing message after v2 was released. Overriding it with the conversation settings\ncontent: ${JSON.stringify(
        content
      )}\n\nconvoToUpdate: ${JSON.stringify(convoToUpdate)}`
    );

    expireUpdate.expirationTimer = convoToUpdate.get('expireTimer');
    expireUpdate.expirationType = changeToDisappearingMessageType(
      convoToUpdate,
      expireUpdate.expirationTimer,
      convoToUpdate.get('expirationType')
    );
    expireUpdate.isLegacyDataMessage = true;
  }

  return expireUpdate;
}

// TODO legacy messages support will be removed in a future release
export function getMessageReadyToDisappear(
  conversationModel: ConversationModel,
  messageModel: MessageModel,
  expireUpdate?: DisappearingMessageUpdate
) {
  if (!expireUpdate) {
    window.log.debug(`WIP: called getMessageReadyToDisappear() without an expireUpdate`);
    return messageModel;
  }

  if (conversationModel.isPublic()) {
    window.log.warn(
      "getMessageReadyToDisappear() Disappearing messages aren't supported in communities"
    );
    return messageModel;
  }

  const {
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
          ? 0
          : GetNetworkTime.getNowWithNetworkOffset()
        : Number(lastDisappearingMessageChangeTimestamp),
      source: messageModel.get('source'),
    };

    messageModel.set({
      expirationTimerUpdate,
    });
  }

  return messageModel;
}

export async function checkHasOutdatedDisappearingMessageClient(
  convoToUpdate: ConversationModel,
  sender: ConversationModel,
  expireUpdate: DisappearingMessageUpdate
) {
  const isOutdated =
    expireUpdate.isLegacyDataMessage ||
    expireUpdate.isLegacyConversationSettingMessage ||
    expireUpdate.shouldDisappearButIsntMessage;

  const outdatedSender =
    sender.get('nickname') || sender.get('displayNameInProfile') || sender.get('id');

  if (convoToUpdate.get('hasOutdatedClient')) {
    // trigger notice banner
    if (isOutdated) {
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
    await convoToUpdate.commit();
    return;
  }

  if (isOutdated) {
    convoToUpdate.set({
      hasOutdatedClient: outdatedSender,
    });
    await convoToUpdate.commit();
  }
}
