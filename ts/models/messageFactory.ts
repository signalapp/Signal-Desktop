import { UserUtils } from '../session/utils';
import { SessionUtilConvoInfoVolatile } from '../session/utils/libsession/libsession_utils_convo_info_volatile';
import { READ_MESSAGE_STATE } from './conversationAttributes';
import { MessageModel } from './message';
import { MessageAttributesOptionals, MessageModelType } from './messageType';

function getSharedAttributesForSwarmMessage({
  conversationId,
  messageHash,
  sentAt,
}: {
  conversationId: string;
  messageHash: string;
  sentAt: number;
}) {
  const now = Date.now();
  return {
    sent_at: sentAt,
    received_at: now,
    conversationId,
    messageHash,
  };
}

/**
 * This function is only called when we get a message from ourself from a swarm polling event.
 *
 * NOTE: conversationId has to be the conversation in which this message should be added. So
 * either syncTarget, groupId or envelope.source or senderIdentity
 */
export function createSwarmMessageSentFromUs(args: {
  messageHash: string;
  sentAt: number;
  conversationId: string;
}): MessageModel {
  // for messages we did send, we mark it as read and start the expiration timer
  const messageData: MessageAttributesOptionals = {
    ...getSharedAttributesForSwarmMessage(args),
    ...getSharedAttributesForOutgoingMessage(),
  };

  return new MessageModel(messageData);
}

/**
 * This function is only called by the Receiver when we get a message
 *  from someone else than ourself from a swarm polling event
 * NOTE: conversationId has to be the conversation in which this message should be added. So
 * either syncTarget, groupId or envelope.source or senderIdentity
 */
export function createSwarmMessageSentFromNotUs(args: {
  messageHash: string;
  sentAt: number;
  sender: string;
  conversationId: string;
}): MessageModel {
  const messageAttributes: MessageAttributesOptionals = {
    ...getSharedAttributesForSwarmMessage(args),
    ...getSharedAttributesForIncomingMessage(),
    source: args.sender,
  };

  markAttributesAsReadIfNeeded(messageAttributes);
  return new MessageModel(messageAttributes);
}

function getSharedAttributesForPublicMessage({
  serverTimestamp,
  serverId,
  conversationId,
}: {
  serverId: number;
  serverTimestamp: number;
  conversationId: string;
}) {
  return {
    serverTimestamp: serverTimestamp || undefined,
    serverId: serverId || undefined,
    sent_at: serverTimestamp,
    received_at: serverTimestamp,
    isPublic: true,
    conversationId,
    messageHash: '', // we do not care of a messageHash for an opengroup message. we have serverId for that
    // NOTE Community messages do not support disappearing messages
    expirationStartTimestamp: undefined,
  };
}

function getSharedAttributesForOutgoingMessage() {
  return {
    source: UserUtils.getOurPubKeyStrFromCache(),
    unread: READ_MESSAGE_STATE.read,
    sent_to: [],
    sent: true,
    type: 'outgoing' as MessageModelType,
    direction: 'outgoing' as MessageModelType,
  };
}

function getSharedAttributesForIncomingMessage() {
  return {
    unread: READ_MESSAGE_STATE.unread, // default to unread, but markAttributesAsReadIfNeeded will override it if needed
    type: 'incoming' as MessageModelType,
    direction: 'incoming' as MessageModelType,
  };
}

export function markAttributesAsReadIfNeeded(messageAttributes: MessageAttributesOptionals) {
  // if the message is trying to be added unread, make sure that it shouldn't be already read from our other devices
  if (messageAttributes.unread === READ_MESSAGE_STATE.unread) {
    const latestUnreadForThisConvo = SessionUtilConvoInfoVolatile.getVolatileInfoCached(
      messageAttributes.conversationId
    );
    const sentAt = messageAttributes.serverTimestamp || messageAttributes.sent_at;
    if (
      sentAt &&
      latestUnreadForThisConvo?.lastRead &&
      sentAt <= latestUnreadForThisConvo.lastRead
    ) {
      // The message was sent before our last read timestamp for that conversation.
      // eslint-disable-next-line no-param-reassign
      messageAttributes.unread = READ_MESSAGE_STATE.read;
    }
  }
}

/**
 * This function is only called when we get a message from ourself from an opengroup polling event
 */
export function createPublicMessageSentFromUs(args: {
  serverId: number;
  serverTimestamp: number;
  conversationId: string;
}): MessageModel {
  const messageData: MessageAttributesOptionals = {
    ...getSharedAttributesForPublicMessage(args),
    ...getSharedAttributesForOutgoingMessage(),
  };

  return new MessageModel(messageData);
}

/**
 * This function is only called by the Receiver when we get a message
 *  from someone else than ourself from an opengroup polling event
 */
export function createPublicMessageSentFromNotUs(args: {
  serverId: number;
  sender: string;
  serverTimestamp: number;
  conversationId: string;
}): MessageModel {
  const messageAttributes: MessageAttributesOptionals = {
    ...getSharedAttributesForPublicMessage(args),
    ...getSharedAttributesForIncomingMessage(),
    source: args.sender,
  };
  markAttributesAsReadIfNeeded(messageAttributes);

  return new MessageModel(messageAttributes);
}
