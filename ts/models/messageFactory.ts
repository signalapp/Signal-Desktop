import { UserUtils } from '../session/utils';
import { MessageModel } from './message';
import { MessageAttributesOptionals, MessageModelType } from './messageType';

export type MessageCreationData = {
  timestamp: number;
  receivedAt: number;
  source: string;
  isPublic: boolean;
  serverId: number | null;
  serverTimestamp: number | null;
  groupId: string | null;

  expirationStartTimestamp?: number;
  destination: string;
  messageHash: string;
};

function initIncomingMessage(data: MessageCreationData): MessageModel {
  const {
    timestamp,
    isPublic,
    receivedAt,
    source,
    serverId,
    serverTimestamp,
    messageHash,
    groupId,
  } = data;

  const messageData: MessageAttributesOptionals = {
    source,
    serverId: serverId || undefined,
    sent_at: timestamp,
    serverTimestamp: serverTimestamp || undefined,
    received_at: receivedAt || Date.now(),
    conversationId: groupId ?? source,
    type: 'incoming',
    direction: 'incoming',
    unread: 1,
    isPublic,
    messageHash: messageHash || undefined,
  };

  return new MessageModel(messageData);
}

/**
 * This function can be called for either a sync message or a message synced through an opengroup poll.
 * This does not save it to the db, just in memory
 */
function createMessageSentFromOurself({
  timestamp,
  serverTimestamp,
  serverId,
  isPublic,
  receivedAt,
  expirationStartTimestamp,
  destination,
  groupId,
  messageHash,
}: {
  timestamp: number;
  receivedAt: number;
  isPublic: boolean;
  serverId: number | null;
  serverTimestamp: number | null;
  groupId: string | null;
  expirationStartTimestamp: number | null;
  destination: string;
  messageHash: string;
}): MessageModel {
  // Omit<
  //   MessageAttributesOptionals,
  //   'conversationId' | 'source' | 'type' | 'direction' | 'received_at'
  // >
  const now = Date.now();

  const messageData: MessageAttributesOptionals = {
    source: UserUtils.getOurPubKeyStrFromCache(),
    type: 'outgoing' as MessageModelType,
    serverTimestamp: serverTimestamp || undefined,
    serverId: serverId || undefined,
    sent_at: timestamp,
    received_at: isPublic ? receivedAt : now,
    isPublic,
    conversationId: groupId ?? destination,
    messageHash,
    unread: 0,
    sent_to: [],
    sent: true,
    expirationStartTimestamp: Math.min(expirationStartTimestamp || data.timestamp || now, now),
  };

  return new MessageModel(messageData);
}

/**
 * This function is only called when we get a message from ourself from an opengroup polling event
 */
export function createPublicMessageSentFromUs({
  serverTimestamp,
  serverId,
  conversationId,
}: {
  serverId: number;
  serverTimestamp: number;
  conversationId: string;
}): MessageModel {
  const messageData: MessageAttributesOptionals = {
    source: UserUtils.getOurPubKeyStrFromCache(),
    type: 'outgoing' as MessageModelType,
    serverTimestamp: serverTimestamp || undefined,
    serverId: serverId || undefined,
    sent_at: serverTimestamp,
    received_at: serverTimestamp,
    isPublic: true,
    conversationId,
    messageHash: '', // we do not care of a messageHash for an opengroup message. we have serverId for that
    unread: 0,
    sent_to: [],
    sent: true,
    expirationStartTimestamp: undefined,
  };

  return new MessageModel(messageData);
}

/**
 * This function is only called by the Receiver when we get a message
 *  from someone else than ourself from an opengroup polling event
 */
export function createPublicMessageSentFromNotUs({
  serverTimestamp,
  serverId,
  conversationId,
  sender,
}: {
  serverId: number;
  sender: string;
  serverTimestamp: number;
  conversationId: string;
}): MessageModel {
  const messageData: MessageAttributesOptionals = {
    source: sender,
    conversationId,
    type: 'incoming' as MessageModelType,
    serverTimestamp: serverTimestamp,
    sent_at: serverTimestamp,
    received_at: serverTimestamp,
    serverId,
    isPublic: true,
    messageHash: '', // we do not care of a messageHash for an opengroup message. we have serverId for that
    unread: 1,
    expirationStartTimestamp: undefined,
  };

  return new MessageModel(messageData);
}
