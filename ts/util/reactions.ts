import { isEmpty } from 'lodash';
import { Data } from '../data/data';
import { MessageModel } from '../models/message';
import { SignalService } from '../protobuf';
import {
  getUsBlindedInThatServer,
  isUsAnySogsFromCache,
} from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { UserUtils } from '../session/utils';

import { Action, OpenGroupReactionList, ReactionList, RecentReactions } from '../types/Reaction';
import { getRecentReactions, saveRecentReations } from '../util/storage';

const rateCountLimit = 20;
const rateTimeLimit = 60 * 1000;
const latestReactionTimestamps: Array<number> = [];

/**
 * Retrieves the original message of a reaction
 */
const getMessageByReaction = async (
  reaction: SignalService.DataMessage.IReaction
): Promise<MessageModel | null> => {
  let originalMessage = null;
  const originalMessageId = Number(reaction.id);
  const originalMessageAuthor = reaction.author;

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

  if (!originalMessage) {
    window?.log?.warn(`Cannot find the original reacted message ${originalMessageId}.`);
    return null;
  }

  return originalMessage;
};

/**
 * Sends a Reaction Data Message, don't use for OpenGroups
 */
export const sendMessageReaction = async (messageId: string, emoji: string) => {
  const found = await Data.getMessageById(messageId);
  if (found) {
    const conversationModel = found?.getConversation();
    if (!conversationModel) {
      window.log.warn(`Conversation for ${messageId} not found in db`);
      return;
    }

    if (!conversationModel.hasReactions()) {
      window.log.warn("This conversation doesn't have reaction support");
      return;
    }

    // TODO need to add rate limiting to SOGS function
    const timestamp = Date.now();
    latestReactionTimestamps.push(timestamp);

    if (latestReactionTimestamps.length > rateCountLimit) {
      const firstTimestamp = latestReactionTimestamps[0];
      if (timestamp - firstTimestamp < rateTimeLimit) {
        latestReactionTimestamps.pop();
        return;
      } else {
        latestReactionTimestamps.shift();
      }
    }

    if (found?.get('isPublic')) {
      window.log.warn("sendMessageReaction() shouldn't be used in opengroups");
      return;
    }

    const id = Number(found.get('sent_at'));
    const me = UserUtils.getOurPubKeyStrFromCache();
    const author = found.get('source');
    let action: Action = Action.REACT;

    const reacts = found.get('reacts');
    if (reacts && Object.keys(reacts).includes(emoji) && reacts[emoji].senders.includes(me)) {
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
      id
    );
    return reaction;
  } else {
    window.log.warn(`Message ${messageId} not found in db`);
    return;
  }
};

/**
 * Handle reactions on the client by updating the state of the source message
 * Do not use for Open Groups
 */
export const handleMessageReaction = async (
  reaction: SignalService.DataMessage.IReaction,
  sender: string
) => {
  if (!reaction.emoji) {
    window?.log?.warn(`There is no emoji for the reaction ${reaction}.`);
    return;
  }

  const originalMessage = await getMessageByReaction(reaction);
  if (!originalMessage) {
    return;
  }

  if (originalMessage.get('isPublic')) {
    window.log.warn("handleMessageReaction() shouldn't be used in opengroups");
    return;
  }

  const reacts: ReactionList = originalMessage.get('reacts') ?? {};
  reacts[reaction.emoji] = reacts[reaction.emoji] || { count: null, senders: [] };
  const details = reacts[reaction.emoji] ?? {};
  const senders = details.senders;
  let count = details.count || 0;

  window.log.info(
    `${sender} ${reaction.action === Action.REACT ? 'added' : 'removed'} a ${
      reaction.emoji
    } reaction`
  );

  switch (reaction.action) {
    case Action.REACT:
      if (senders.includes(sender)) {
        window.log.warn('Received duplicate reaction message. Ignoring it', reaction, sender);
        return;
      }
      details.senders.push(sender);
      count += 1;
      break;
    case Action.REMOVE:
    default:
      if (senders && senders.length > 0) {
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

    if (details && details.index === undefined) {
      reacts[reaction.emoji].index = originalMessage.get('reactsIndex') ?? 0;
      originalMessage.set('reactsIndex', (originalMessage.get('reactsIndex') ?? 0) + 1);
    }
  } else {
    // tslint:disable-next-line: no-dynamic-delete
    delete reacts[reaction.emoji];
  }

  originalMessage.set({
    reacts: !isEmpty(reacts) ? reacts : undefined,
  });

  await originalMessage.commit();
  return originalMessage;
};

/**
 * Handles all message reaction updates for opengroups
 */
export const handleOpenGroupMessageReactions = async (
  reactions: OpenGroupReactionList,
  serverId: number
) => {
  const originalMessage = await Data.getMessageByServerId(serverId);
  if (!originalMessage) {
    window?.log?.warn(`Cannot find the original reacted message ${serverId}.`);
    return;
  }

  if (!originalMessage.get('isPublic')) {
    window.log.warn('handleOpenGroupMessageReactions() should only be used in opengroups');
    return;
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
        if (reactions[key].reactors && reactions[key].reactors.length > 0) {
          const reactorsWithoutMe = reactions[key].reactors.filter(
            reactor => !isUsAnySogsFromCache(reactor)
          );

          const conversationModel = originalMessage?.getConversation();
          if (conversationModel) {
            const me =
              getUsBlindedInThatServer(conversationModel) || UserUtils.getOurPubKeyStrFromCache();
            reactions[key].reactors = [me, ...reactorsWithoutMe];
          }
        }
      }

      const senders: Array<string> = [];
      reactions[key].reactors.forEach(reactor => {
        senders.push(reactor);
      });

      reacts[emoji] = {
        count: reactions[key].count,
        index: reactions[key].index,
        senders,
        you,
      };
    });

    originalMessage.set({
      reacts,
    });
  }

  await originalMessage.commit();
  return originalMessage;
};

export const updateRecentReactions = async (reactions: Array<string>, newReaction: string) => {
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
