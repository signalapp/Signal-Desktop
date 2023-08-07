import { isEmpty } from 'lodash';
import { Data } from '../data/data';
import { MessageModel } from '../models/message';
import { SignalService } from '../protobuf';
import { isUsAnySogsFromCache } from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { ToastUtils, UserUtils } from '../session/utils';

import { Action, OpenGroupReactionList, ReactionList, RecentReactions } from '../types/Reaction';
import { getRecentReactions, saveRecentReations } from './storage';

const SOGSReactorsFetchCount = 5;
const rateCountLimit = 20;
const rateTimeLimit = 60 * 1000;
const latestReactionTimestamps: Array<number> = [];

function hitRateLimit(): boolean {
  const now = Date.now();
  latestReactionTimestamps.push(now);

  if (latestReactionTimestamps.length > rateCountLimit) {
    const firstTimestamp = latestReactionTimestamps[0];
    if (now - firstTimestamp < rateTimeLimit) {
      latestReactionTimestamps.pop();
      window.log.warn(`Only ${rateCountLimit} reactions are allowed per minute`);
      return true;
    }
    latestReactionTimestamps.shift();
  }
  return false;
}

/**
 * Retrieves the original message of a reaction
 */
const getMessageByReaction = async (
  reaction: SignalService.DataMessage.IReaction,
  openGroupConversationId?: string
): Promise<MessageModel | null> => {
  let originalMessage = null;
  const originalMessageId = Number(reaction.id);
  const originalMessageAuthor = reaction.author;

  if (openGroupConversationId && !isEmpty(openGroupConversationId)) {
    originalMessage = await Data.getMessageByServerId(openGroupConversationId, originalMessageId);
  } else {
    const collection = await Data.getMessagesBySentAt(originalMessageId);
    originalMessage = collection.find((item: MessageModel) => {
      const messageTimestamp = item.get('sent_at');
      const author = item.get('source');
      return Boolean(
        messageTimestamp &&
          messageTimestamp === originalMessageId &&
          author &&
          author === originalMessageAuthor
      );
    });
  }

  if (!originalMessage) {
    window?.log?.debug(`Cannot find the original reacted message ${originalMessageId}.`);
    return null;
  }

  return originalMessage;
};

/**
 * Sends a Reaction Data Message
 */
const sendMessageReaction = async (messageId: string, emoji: string) => {
  const found = await Data.getMessageById(messageId);
  if (found) {
    const conversationModel = found?.getConversation();
    if (!conversationModel) {
      window.log.warn(`Conversation for ${messageId} not found in db`);
      return undefined;
    }

    if (!conversationModel.hasReactions()) {
      window.log.warn("This conversation doesn't have reaction support");
      return undefined;
    }

    if (hitRateLimit()) {
      ToastUtils.pushRateLimitHitReactions();
      return undefined;
    }

    let me = UserUtils.getOurPubKeyStrFromCache();
    let id = Number(found.get('sent_at'));

    if (found.get('isPublic')) {
      if (found.get('serverId')) {
        id = found.get('serverId') || id;
        me = conversationModel.getUsInThatConversation();
      } else {
        window.log.warn(`Server Id was not found in message ${messageId} for opengroup reaction`);
        return undefined;
      }
    }

    const author = found.get('source');
    let action: Action = Action.REACT;

    const reacts = found.get('reacts');
    if (reacts?.[emoji]?.senders?.includes(me)) {
      window.log.info('Found matching reaction removing it');
      action = Action.REMOVE;
    } else {
      const reactions = getRecentReactions();
      if (reactions) {
        await updateRecentReactions(reactions, emoji);
      }
    }

    const reaction = {
      id,
      author,
      emoji,
      action,
    };

    await conversationModel.sendReaction(messageId, reaction);

    window.log.info(
      `You ${action === Action.REACT ? 'added' : 'removed'} a`,
      emoji,
      'reaction for message',
      id,
      found.get('isPublic') ? `on ${conversationModel.id}` : ''
    );
    return reaction;
  }
  window.log.warn(`Message ${messageId} not found in db`);
  return undefined;
};

/**
 * Handle reactions on the client by updating the state of the source message
 * Used in OpenGroups for sending reactions only, not handling responses
 */
const handleMessageReaction = async ({
  reaction,
  sender,
  you,
  openGroupConversationId,
}: {
  reaction: SignalService.DataMessage.IReaction;
  sender: string;
  you: boolean;
  openGroupConversationId?: string;
}) => {
  if (!reaction.emoji) {
    window?.log?.warn(`There is no emoji for the reaction ${reaction}.`);
    return undefined;
  }

  const originalMessage = await getMessageByReaction(reaction, openGroupConversationId);
  if (!originalMessage) {
    return undefined;
  }

  const reacts: ReactionList = originalMessage.get('reacts') ?? {};
  reacts[reaction.emoji] = reacts[reaction.emoji] || { count: null, senders: [] };
  const details = reacts[reaction.emoji] ?? {};
  const senders = details.senders;
  let count = details.count || 0;

  if (details.you && senders.includes(sender)) {
    if (reaction.action === Action.REACT) {
      window.log.warn('Received duplicate message for your reaction. Ignoring it');
      return undefined;
    }
    details.you = false;
  } else {
    details.you = you;
  }

  switch (reaction.action) {
    case Action.REACT:
      if (senders.includes(sender)) {
        window.log.warn('Received duplicate reaction message. Ignoring it', reaction, sender);
        return undefined;
      }
      details.senders.push(sender);
      count += 1;
      break;
    case Action.REMOVE:
    default:
      if (senders?.length > 0) {
        const sendersIndex = senders.indexOf(sender);
        if (sendersIndex >= 0) {
          details.senders.splice(sendersIndex, 1);
          count -= 1;
        }
      }
  }

  if (count > 0) {
    reacts[reaction.emoji].count = count;
    reacts[reaction.emoji].senders = details.senders;
    reacts[reaction.emoji].you = details.you;

    if (details && details.index === undefined) {
      reacts[reaction.emoji].index = originalMessage.get('reactsIndex') ?? 0;
      originalMessage.set('reactsIndex', (originalMessage.get('reactsIndex') ?? 0) + 1);
    }
  } else {
    delete reacts[reaction.emoji];
  }

  originalMessage.set({
    reacts: !isEmpty(reacts) ? reacts : undefined,
  });

  await originalMessage.commit();

  if (!you) {
    window.log.info(
      `${sender} ${reaction.action === Action.REACT ? 'added' : 'removed'} a ${
        reaction.emoji
      } reaction`
    );
  }
  return originalMessage;
};

/**
 * Handles updating the UI when clearing all reactions for a certain emoji
 * Only usable by moderators in opengroups and runs on their client
 */
const handleClearReaction = async (conversationId: string, serverId: number, emoji: string) => {
  const originalMessage = await Data.getMessageByServerId(conversationId, serverId);
  if (!originalMessage) {
    window?.log?.debug(
      `Cannot find the original reacted message ${serverId} in conversation ${conversationId}.`
    );
    return undefined;
  }

  const reacts: ReactionList | undefined = originalMessage.get('reacts');
  if (reacts) {
    delete reacts[emoji];
  }

  originalMessage.set({
    reacts: !isEmpty(reacts) ? reacts : undefined,
  });

  await originalMessage.commit();

  window.log.info(`You cleared all ${emoji} reactions on message ${serverId}`);
  return originalMessage;
};

/**
 * Handles all message reaction updates/responses for opengroups
 * serverIds are not unique so we need the conversationId
 */
const handleOpenGroupMessageReactions = async (
  conversationId: string,
  serverId: number,
  reactions: OpenGroupReactionList
) => {
  const originalMessage = await Data.getMessageByServerId(conversationId, serverId);
  if (!originalMessage) {
    window?.log?.debug(
      `Cannot find the original reacted message ${serverId} in conversation ${conversationId}.`
    );
    return undefined;
  }

  if (!originalMessage.get('isPublic')) {
    window.log.warn('handleOpenGroupMessageReactions() should only be used in opengroups');
    return undefined;
  }

  if (isEmpty(reactions)) {
    if (originalMessage.get('reacts')) {
      originalMessage.set({
        reacts: undefined,
      });
    }
  } else {
    const reacts: ReactionList = {};
    Object.keys(reactions).forEach(key => {
      const emoji = decodeURI(key);
      const you = reactions[key].you || false;

      if (you) {
        if (reactions[key]?.reactors.length > 0) {
          const reactorsWithoutMe = reactions[key].reactors.filter(
            reactor => !isUsAnySogsFromCache(reactor)
          );

          // If we aren't included in the reactors then remove the extra reactor to match with the SOGSReactorsFetchCount.
          if (reactorsWithoutMe.length === SOGSReactorsFetchCount) {
            reactorsWithoutMe.pop();
          }

          const conversationModel = originalMessage?.getConversation();
          if (conversationModel) {
            const me =
              conversationModel.getUsInThatConversation() || UserUtils.getOurPubKeyStrFromCache();
            // eslint-disable-next-line no-param-reassign
            reactions[key].reactors = [me, ...reactorsWithoutMe];
          }
        }
      }

      const senders: Array<string> = [];
      reactions[key].reactors.forEach(reactor => {
        senders.push(reactor);
      });

      if (reactions[key].count > 0) {
        reacts[emoji] = {
          count: reactions[key].count,
          index: reactions[key].index,
          senders,
          you,
        };
      } else {
        delete reacts[key];
      }
    });

    originalMessage.set({
      reacts,
    });
  }

  await originalMessage.commit();
  return originalMessage;
};

const updateRecentReactions = async (reactions: Array<string>, newReaction: string) => {
  window?.log?.info('updating recent reactions with', newReaction);
  const recentReactions = new RecentReactions(reactions);
  const foundIndex = recentReactions.items.indexOf(newReaction);
  if (foundIndex === 0) {
    return;
  }
  if (foundIndex > 0) {
    recentReactions.swap(foundIndex);
  } else {
    recentReactions.push(newReaction);
  }
  await saveRecentReations(recentReactions.items);
};

// exported for testing purposes
export const Reactions = {
  SOGSReactorsFetchCount,
  hitRateLimit,
  sendMessageReaction,
  handleMessageReaction,
  handleClearReaction,
  handleOpenGroupMessageReactions,
  updateRecentReactions,
};
