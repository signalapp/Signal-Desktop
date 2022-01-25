import { UserUtils } from '../session/utils';
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
    expirationStartTimestamp: Math.min(args.sentAt, Date.now()),
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
  const messageData: MessageAttributesOptionals = {
    ...getSharedAttributesForSwarmMessage(args),
    ...getSharedAttributesForIncomingMessage(),
    source: args.sender,
  };

  return new MessageModel(messageData);
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
    expirationStartTimestamp: undefined,
  };
}

function getSharedAttributesForOutgoingMessage() {
  return {
    source: UserUtils.getOurPubKeyStrFromCache(),
    unread: 0,
    sent_to: [],
    sent: true,
    type: 'outgoing' as MessageModelType,
    direction: 'outgoing' as MessageModelType,
  };
}

function getSharedAttributesForIncomingMessage() {
  return {
    unread: 1,
    type: 'incoming' as MessageModelType,
    direction: 'incoming' as MessageModelType,
  };
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
  const messageData: MessageAttributesOptionals = {
    ...getSharedAttributesForPublicMessage(args),
    ...getSharedAttributesForIncomingMessage(),
    source: args.sender,
  };

  return new MessageModel(messageData);
}
