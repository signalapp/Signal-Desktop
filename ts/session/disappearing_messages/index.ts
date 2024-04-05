import { isEmpty, isNumber, throttle, uniq } from 'lodash';
import { messagesExpired } from '../../state/ducks/conversations';
import { initWallClockListener } from '../../util/wallClockListener';

import { Data } from '../../data/data';
import { ConversationModel } from '../../models/conversation';
import { READ_MESSAGE_STATE } from '../../models/conversationAttributes';
import { MessageModel } from '../../models/message';
import { SignalService } from '../../protobuf';
import { ReleasedFeatures } from '../../util/releaseFeature';
import { ExpiringDetails, expireMessagesOnSnode } from '../apis/snode_api/expireRequest';
import { GetNetworkTime } from '../apis/snode_api/getNetworkTime';
import { getConversationController } from '../conversations';
import { isValidUnixTimestamp } from '../utils/Timestamps';
import { UpdateMsgExpirySwarm } from '../utils/job_runners/jobs/UpdateMsgExpirySwarmJob';
import {
  checkIsLegacyDisappearingDataMessage,
  couldBeLegacyDisappearingMessageContent,
} from './legacy';
import {
  DisappearingMessageConversationModeType,
  DisappearingMessageMode,
  DisappearingMessageType,
  DisappearingMessageUpdate,
  ReadyToDisappearMsgUpdate,
} from './types';

async function destroyMessagesAndUpdateRedux(
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
    for (let i = 0; i < messageIds.length; i++) {
      /* eslint-disable no-await-in-loop */
      // TODO make this use getMessagesById and not getMessageById

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
    getConversationController().get(convoIdToUpdate)?.updateLastMessage();
  });
}

async function destroyExpiredMessages() {
  try {
    window.log.info('destroyExpiredMessages: Loading messages...');
    const messages = await Data.getExpiredMessages();
    window.log.debug('destroyExpiredMessages: count:', messages.length);

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
        hash: expired.getMessageHash(),
      });
    });

    await destroyMessagesAndUpdateRedux(messagesExpiredDetails);
    const convosToRefresh = uniq(messagesExpiredDetails.map(m => m.conversationKey));
    window.log.info('destroyExpiredMessages: convosToRefresh:', convosToRefresh);
    await Promise.all(
      convosToRefresh.map(async c => {
        getConversationController().get(c)?.updateLastMessage();
        return getConversationController().get(c)?.refreshInMemoryDetails();
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

  const expiresAt = next.getExpiresAt();
  if (!expiresAt || !isNumber(expiresAt)) {
    return;
  }

  const ms = expiresAt - Date.now();
  window.log.info(
    `message with hash:${next.getMessageHash()} expires in ${ms}ms, or ${Math.floor(
      ms / 1000
    )}s, or ${Math.floor(ms / (3600 * 1000))}h`
  );

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

function setExpirationStartTimestamp(
  mode: DisappearingMessageConversationModeType,
  timestamp?: number,
  // these are for debugging purposes
  callLocation?: string,
  messageId?: string
): number | undefined {
  let expirationStartTimestamp: number | undefined = GetNetworkTime.getNowWithNetworkOffset();

  if (callLocation) {
    // window.log.debug(
    //   `[setExpirationStartTimestamp] called from: ${callLocation} ${
    //     messageId ? `messageId: ${messageId} ` : ''
    //   }`
    // );
  }

  // TODO legacy messages support will be removed in a future release
  if (timestamp) {
    if (!isValidUnixTimestamp(timestamp)) {
      window.log.debug(
        `[setExpirationStartTimestamp] We compared 2 timestamps for a disappearing message (${mode}) and the argument timestamp is not a invalid unix timestamp.${
          messageId ? `messageId: ${messageId} ` : ''
        }`
      );
      return undefined;
    }
    expirationStartTimestamp = Math.min(expirationStartTimestamp, timestamp);
  }

  switch (mode) {
    case 'deleteAfterRead':
      // window.log.debug(
      //   `[setExpirationStartTimestamp] We set the start timestamp for a delete after read message to ${new Date(
      //     expirationStartTimestamp
      //   ).toLocaleTimeString()}${messageId ?  `messageId: ${messageId} ` : ''}`
      // );
      break;
    case 'deleteAfterSend':
      // window.log.debug(
      //   `[setExpirationStartTimestamp] We set the start timestamp for a delete after send message to ${new Date(
      //     expirationStartTimestamp
      //   ).toLocaleTimeString()}${messageId ?  `messageId: ${messageId} ` : ''}`
      // );
      break;
    // TODO legacy messages support will be removed in a future release
    case 'legacy':
      // window.log.debug(
      //   `[setExpirationStartTimestamp] We set the start timestamp for a legacy message to ${new Date(
      //     expirationStartTimestamp
      //   ).toLocaleTimeString()} ${messageId ?  `messageId: ${messageId} ` : ''}`
      // );
      break;
    case 'off':
      // window.log.debug(
      //   `[setExpirationStartTimestamp] Disappearing message mode has been turned off. We can safely ignore this. ${messageId ?  `messageId: ${messageId} ` : ''}`
      // );
      expirationStartTimestamp = undefined;
      break;
    default:
      window.log.debug(
        `[setExpirationStartTimestamp] Invalid disappearing message mode "${mode}" set. Ignoring.${
          messageId ? `messageId: ${messageId} ` : ''
        }`
      );
      expirationStartTimestamp = undefined;
  }

  return expirationStartTimestamp;
}

// TODO legacy messages support will be removed in a future release
/**
 * Converts DisappearingMessageConversationModeType to DisappearingMessageType
 *
 * NOTE Used for sending or receiving data messages (protobuf)
 *
 * @param convo Conversation we want to set
 * @param expirationMode DisappearingMessageConversationModeType
 * @returns Disappearing mode we should use
 */
function changeToDisappearingMessageType(
  convo: ConversationModel,
  expireTimer: number,
  expirationMode?: DisappearingMessageConversationModeType
): DisappearingMessageType {
  if (expirationMode === 'off' || expirationMode === 'legacy') {
    // NOTE we would want this to be undefined but because of an issue with the protobuf implementation we need to have a value
    return 'unknown';
  }

  if (expireTimer > 0) {
    if (convo.isMe() || convo.isClosedGroup()) {
      return 'deleteAfterSend';
    }

    return expirationMode === 'deleteAfterSend' ? 'deleteAfterSend' : 'deleteAfterRead';
  }

  return 'unknown';
}

// TODO legacy messages support will be removed in a future release
/**
 * Forces a private DaS to be a DaR.
 * This should only be used for DataExtractionNotification and CallMessages (the ones saved to the DB) currently.
 * Note: this can only be called for private conversations, excluding ourselves as it throws otherwise (this wouldn't be right)
 * */
function forcedDeleteAfterReadMsgSetting(convo: ConversationModel): {
  expirationType: Exclude<DisappearingMessageType, 'deleteAfterSend'>;
  expireTimer: number;
} {
  if (convo.isMe() || !convo.isPrivate()) {
    throw new Error(
      'forcedDeleteAfterReadMsgSetting can only be called with a private chat (excluding ourselves)'
    );
  }
  const expirationMode = convo.getExpirationMode();
  const expireTimer = convo.getExpireTimer();
  if (expirationMode === 'off' || expirationMode === 'legacy' || expireTimer <= 0) {
    return { expirationType: 'unknown', expireTimer: 0 };
  }

  return {
    expirationType: expirationMode === 'deleteAfterSend' ? 'deleteAfterRead' : expirationMode,
    expireTimer,
  };
}

// TODO legacy messages support will be removed in a future release
/**
 * Forces a private DaR to be a DaS.
 * This should only be used for the outgoing CallMessages that we keep locally only (not synced, just the "you started a call" notification)
 * Note: this can only be called for private conversations, excluding ourselves as it throws otherwise (this wouldn't be right)
 * */
function forcedDeleteAfterSendMsgSetting(convo: ConversationModel): {
  expirationType: Exclude<DisappearingMessageType, 'deleteAfterRead'>;
  expireTimer: number;
} {
  if (convo.isMe() || !convo.isPrivate()) {
    throw new Error(
      'forcedDeleteAfterSendMsgSetting can only be called with a private chat (excluding ourselves)'
    );
  }
  const expirationMode = convo.getExpirationMode();
  const expireTimer = convo.getExpireTimer();
  if (expirationMode === 'off' || expirationMode === 'legacy' || expireTimer <= 0) {
    return { expirationType: 'unknown', expireTimer: 0 };
  }

  return {
    expirationType: expirationMode === 'deleteAfterRead' ? 'deleteAfterSend' : expirationMode,
    expireTimer,
  };
}

// TODO legacy messages support will be removed in a future release
/**
 * Converts DisappearingMessageType to DisappearingMessageConversationModeType
 *
 * NOTE Used for the UI
 *
 * @param convo  Conversation we want to set
 * @param expirationType DisappearingMessageType
 * @param expireTimer in seconds, 0 means no expiration
 * @returns
 */
function changeToDisappearingConversationMode(
  convo: ConversationModel,
  expirationType?: DisappearingMessageType,
  expireTimer?: number
): DisappearingMessageConversationModeType {
  if (!expirationType || expirationType === 'unknown') {
    return expireTimer && expireTimer > 0 ? 'legacy' : 'off';
  }

  if (convo.isMe() || convo.isClosedGroup()) {
    return 'deleteAfterSend';
  }

  return expirationType === 'deleteAfterSend' ? 'deleteAfterSend' : 'deleteAfterRead';
}

// TODO legacy messages support will be removed in a future release
async function checkForExpireUpdateInContentMessage(
  content: SignalService.Content,
  convoToUpdate: ConversationModel,
  messageExpirationFromRetrieve: number | null
): Promise<DisappearingMessageUpdate | undefined> {
  const dataMessage = content.dataMessage as SignalService.DataMessage | undefined;
  // We will only support legacy disappearing messages for a short period before disappearing messages v2 is unlocked
  const isDisappearingMessagesV2Released =
    await ReleasedFeatures.checkIsDisappearMessageV2FeatureReleased();

  const couldBeLegacyContentMessage = couldBeLegacyDisappearingMessageContent(content);
  const isLegacyDataMessage =
    dataMessage && checkIsLegacyDisappearingDataMessage(couldBeLegacyContentMessage, dataMessage);
  const hasExpirationUpdateFlags =
    dataMessage?.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

  const isLegacyConversationSettingMessage = isDisappearingMessagesV2Released
    ? (isLegacyDataMessage || couldBeLegacyContentMessage) && hasExpirationUpdateFlags
    : couldBeLegacyContentMessage && hasExpirationUpdateFlags;

  const expirationTimer = isLegacyDataMessage
    ? Number(dataMessage.expireTimer)
    : content.expirationTimer;

  // NOTE we don't use the expirationType directly from the Content Message because we need to resolve it to the correct convo type first in case it is legacy or has errors
  const expirationMode = changeToDisappearingConversationMode(
    convoToUpdate,
    DisappearingMessageMode[content.expirationType],
    expirationTimer
  );

  const expireUpdate: DisappearingMessageUpdate = {
    expirationType: changeToDisappearingMessageType(convoToUpdate, expirationTimer, expirationMode),
    expirationTimer,
    isLegacyConversationSettingMessage,
    isLegacyDataMessage,
    isDisappearingMessagesV2Released,
    messageExpirationFromRetrieve,
  };

  // NOTE some platforms do not include the diappearing message values in the Data Message for sent messages so we have to trust the conversation settings until v2 is released
  if (
    !isDisappearingMessagesV2Released &&
    !isLegacyConversationSettingMessage &&
    couldBeLegacyContentMessage &&
    convoToUpdate.getExpirationMode() !== 'off'
  ) {
    if (
      expirationMode !== convoToUpdate.getExpirationMode() ||
      expirationTimer !== convoToUpdate.getExpireTimer()
    ) {
      window.log.debug(
        `[checkForExpireUpdateInContentMessage] Received a legacy disappearing message before v2 was released for ${convoToUpdate.get(
          'id'
        )}. Overriding it with the conversation disappearing settings.\ncontent: ${JSON.stringify(
          content
        )}`
      );

      expireUpdate.expirationTimer = convoToUpdate.getExpireTimer();
      expireUpdate.expirationType = changeToDisappearingMessageType(
        convoToUpdate,
        expireUpdate.expirationTimer,
        convoToUpdate.getExpirationMode()
      );
      expireUpdate.isLegacyDataMessage = true;
    }
  }

  // NOTE If it is a legacy message and disappearing messages v2 is released then we ignore it and use the local client's conversation settings and show the outdated client banner
  if (
    isDisappearingMessagesV2Released &&
    (isLegacyDataMessage || isLegacyConversationSettingMessage)
  ) {
    window.log.debug(
      `[checkForExpireUpdateInContentMessage] Received a legacy disappearing message after v2 was released for ${convoToUpdate.get(
        'id'
      )}. Overriding it with the conversation settings\ncontent: ${JSON.stringify(content)}`
    );

    expireUpdate.expirationTimer = convoToUpdate.getExpireTimer();
    expireUpdate.expirationType = changeToDisappearingMessageType(
      convoToUpdate,
      expireUpdate.expirationTimer,
      convoToUpdate.getExpirationMode()
    );
    expireUpdate.isLegacyDataMessage = true;
  }

  return expireUpdate;
}

/**
 * Checks if an outgoing message is meant to disappear and if so trigger the timer
 */
function checkForExpiringOutgoingMessage(message: MessageModel, location?: string) {
  const convo = message.getConversation();
  const expireTimer = message.getExpireTimerSeconds();
  const expirationType = message.getExpirationType();

  const isGroupConvo = !!convo?.isClosedGroup();
  const isControlMessage = message.isControlMessage();

  if (
    convo &&
    expirationType &&
    expireTimer > 0 &&
    !message.getExpirationStartTimestamp() &&
    !(isGroupConvo && isControlMessage)
  ) {
    const expirationMode = changeToDisappearingConversationMode(convo, expirationType, expireTimer);

    if (expirationMode !== 'off') {
      message.set({
        expirationStartTimestamp: setExpirationStartTimestamp(
          expirationMode,
          message.get('sent_at'),
          location
        ),
      });
    }
  }
}

// TODO legacy messages support will be removed in a future release
function getMessageReadyToDisappear(
  conversationModel: ConversationModel,
  messageModel: MessageModel,
  messageFlags: number,
  expireUpdate?: ReadyToDisappearMsgUpdate
) {
  if (conversationModel.isPublic()) {
    throw Error(
      `getMessageReadyToDisappear() Disappearing messages aren't supported in communities`
    );
  }
  if (!expireUpdate) {
    window.log.debug(
      `[getMessageReadyToDisappear] called getMessageReadyToDisappear() without an expireUpdate`
    );
    return messageModel;
  }

  const {
    expirationType,
    expirationTimer: expireTimer,
    messageExpirationFromRetrieve,
  } = expireUpdate;

  // This message is an ExpirationTimerUpdate
  if (messageFlags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE) {
    const expirationTimerUpdate = {
      expirationType,
      expireTimer,
      source: messageModel.get('source'),
    };

    messageModel.set({
      expirationTimerUpdate,
    });
  }

  // Note: We agreed that a control message for legacy groups does not expire
  if (conversationModel.isClosedGroup() && messageModel.isControlMessage()) {
    return messageModel;
  }

  /**
   * This is quite tricky, but when we receive a message from the network, it might be a disappearing after read one, which was already read by another device.
   * If that's the case, we need to not only mark the message as read, but also mark it as read at the right time.
   * So that a message read 20h ago, and expiring 24h after read, has only 4h to live on this device too.
   *
   * A message is marked as read when created, if the convo volatile update reports that it should have been read (check `markAttributesAsReadIfNeeded()` if needed).
   * That means that here, if we have a message
   *   - read,
   *   - incoming,
   *   - and disappearing after read,
   * we have to force its expirationStartTimestamp and expire_at fields so they are in sync with our other devices.
   */
  messageModel.set({
    expirationType,
    expireTimer,
  });

  if (
    conversationModel.isPrivate() &&
    messageModel.isIncoming() &&
    expirationType === 'deleteAfterRead' &&
    expireTimer > 0 &&
    messageModel.get('unread') === READ_MESSAGE_STATE.read &&
    messageExpirationFromRetrieve &&
    messageExpirationFromRetrieve > 0
  ) {
    /**
     * Edge case: when we send a message before we poll for a message sent earlier, our convo volatile update will
     * mark that incoming message as read right away (because it was sent earlier than our latest convolatile lastRead).
     * To take care of this case, we need to check if an incoming DaR message is in a read state but its expiration has not been updated yet.
     * The way we do it, is by checking that the swarm expiration is before (now + expireTimer).
     * If it looks like this expiration was not updated yet, we need to trigger a UpdateExpiryJob for that message.
     */
    const now = GetNetworkTime.getNowWithNetworkOffset();
    const expirationNowPlusTimer = now + expireTimer * 1000;
    const msgExpirationWasAlreadyUpdated = messageExpirationFromRetrieve <= expirationNowPlusTimer;
    // Note: a message might be added even when it expired, but the periodic cleaning of expired message will pick it up and remove it soon enough

    if (msgExpirationWasAlreadyUpdated) {
      const expirationStartTimestamp = messageExpirationFromRetrieve - expireTimer * 1000;
      window.log.debug(
        `incoming DaR message already read by another device, forcing readAt ${
          (Date.now() - expirationStartTimestamp) / 1000
        }s ago, so with ${(messageExpirationFromRetrieve - Date.now()) / 1000}s left`
      );
      messageModel.set({
        expirationStartTimestamp,
        expires_at: messageExpirationFromRetrieve,
      });
    } else {
      window.log.debug(
        `incoming DaR message already read by another device but swarmExpiration seems NOT updated, forcing readAt NOW and triggering UpdateExpiryJob with ${expireTimer}s left`
      );
      messageModel.set({
        expirationStartTimestamp: now,
        expires_at: expirationNowPlusTimer,
      });
      // Ideally we would batch call those UpdateExpiry, but we can't currently and disappear v2 is already too complex as it is.
      void UpdateMsgExpirySwarm.queueNewJobIfNeeded([messageModel.id]);
    }
  } else if (
    expirationType === 'deleteAfterSend' &&
    expireTimer > 0 &&
    messageExpirationFromRetrieve &&
    messageExpirationFromRetrieve > 0
  ) {
    // Note: closed groups control message do not disappear
    if (!conversationModel.isClosedGroup() && !messageModel.isControlMessage()) {
      const expirationStartTimestamp = messageExpirationFromRetrieve - expireTimer * 1000;
      const expires_at = messageExpirationFromRetrieve;
      messageModel.set({
        expirationStartTimestamp,
        expires_at,
      });
    }
  }

  return messageModel;
}

async function checkHasOutdatedDisappearingMessageClient(
  convoToUpdate: ConversationModel,
  sender: ConversationModel,
  expireUpdate: DisappearingMessageUpdate
) {
  const isOutdated =
    expireUpdate.isLegacyDataMessage || expireUpdate.isLegacyConversationSettingMessage;

  const outdatedSender =
    sender.get('nickname') || sender.get('displayNameInProfile') || sender.get('id');

  if (convoToUpdate.getHasOutdatedClient()) {
    // trigger notice banner
    if (isOutdated) {
      if (convoToUpdate.getHasOutdatedClient() !== outdatedSender) {
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

async function updateMessageExpiriesOnSwarm(messages: Array<MessageModel>) {
  const expiringDetails: ExpiringDetails = [];

  messages.forEach(msg => {
    const hash = msg.getMessageHash();
    const timestampStarted = msg.getExpirationStartTimestamp();
    const timerSeconds = msg.getExpireTimerSeconds();
    const disappearingType = msg.getExpirationType();
    if (
      !hash ||
      !timestampStarted ||
      timestampStarted <= 0 ||
      !timerSeconds ||
      timerSeconds <= 0 ||
      disappearingType !== 'deleteAfterRead' || // this is very important as a message not stored on the swarm will be assumed expired, and so deleted locally!
      !msg.isIncoming() // this is very important as a message not stored on the swarm will be assumed expired, and so deleted locally!
    ) {
      return;
    }
    expiringDetails.push({
      messageHash: hash,
      expireTimerMs: timerSeconds * 1000,
      readAt: timestampStarted,
    });
  });

  if (isEmpty(expiringDetails)) {
    window.log.debug(`[updateMessageExpiriesOnSwarm] no expiringDetails to update`);
    return;
  }
  window.log.debug('updateMessageExpiriesOnSwarm: expiringDetails', expiringDetails);

  const newTTLs = await expireMessagesOnSnode(expiringDetails, { shortenOrExtend: 'shorten' });
  const updatedMsgModels: Array<MessageModel> = [];
  window.log.debug('updateMessageExpiriesOnSwarm newTTLs: ', newTTLs);
  newTTLs.forEach(m => {
    const message = messages.find(model => model.getMessageHash() === m.messageHash);
    if (!message) {
      return;
    }

    const newTTLms = m.updatedExpiryMs;
    const realReadAt = newTTLms - message.getExpireTimerSeconds() * 1000;
    if (
      newTTLms &&
      (newTTLms !== message.getExpiresAt() ||
        message.get('expirationStartTimestamp') !== realReadAt) &&
      message.getExpireTimerSeconds()
    ) {
      window.log.debug(`updateMessageExpiriesOnSwarm: setting for msg hash ${m.messageHash}:`, {
        expires_at: newTTLms,
        expirationStartTimestamp: realReadAt,
        unread: READ_MESSAGE_STATE.read,
      });
      message.set({
        expires_at: newTTLms,
        expirationStartTimestamp: realReadAt,
        unread: READ_MESSAGE_STATE.read,
      });

      updatedMsgModels.push(message);
    }
  });

  if (!isEmpty(updatedMsgModels)) {
    await Promise.all(updatedMsgModels.map(m => m.commit()));
  }
}

export const DisappearingMessages = {
  destroyMessagesAndUpdateRedux,
  initExpiringMessageListener,
  updateExpiringMessagesCheck,
  setExpirationStartTimestamp,
  changeToDisappearingMessageType,
  changeToDisappearingConversationMode,
  forcedDeleteAfterReadMsgSetting,
  forcedDeleteAfterSendMsgSetting,
  checkForExpireUpdateInContentMessage,
  checkForExpiringOutgoingMessage,
  getMessageReadyToDisappear,
  checkHasOutdatedDisappearingMessageClient,
  updateMessageExpiriesOnSwarm,
  destroyExpiredMessages,
};
