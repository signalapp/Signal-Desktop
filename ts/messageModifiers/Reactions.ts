// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';
import type { ConversationModel } from '../models/conversations';
import type { MessageModel } from '../models/messages';
import type {
  MessageAttributesType,
  ReactionAttributesType,
} from '../model-types.d';
import * as log from '../logging/log';
import { getContactId, getContact } from '../messages/helpers';
import { isDirectConversation, isMe } from '../util/whatTypeOfConversation';
import { isOutgoing, isStory } from '../state/selectors/message';

export class ReactionModel extends Model<ReactionAttributesType> {}

let singleton: Reactions | undefined;

export class Reactions extends Collection<ReactionModel> {
  static getSingleton(): Reactions {
    if (!singleton) {
      singleton = new Reactions();
    }

    return singleton;
  }

  forMessage(message: MessageModel): Array<ReactionModel> {
    if (isOutgoing(message.attributes)) {
      const outgoingReactions = this.filter(
        item => item.get('targetTimestamp') === message.get('sent_at')
      );

      if (outgoingReactions.length > 0) {
        log.info('Found early reaction for outgoing message');
        this.remove(outgoingReactions);
        return outgoingReactions;
      }
    }

    const senderId = getContactId(message.attributes);
    const sentAt = message.get('sent_at');
    const reactionsBySource = this.filter(re => {
      const targetSender = window.ConversationController.lookupOrCreate({
        uuid: re.get('targetAuthorUuid'),
      });
      const targetTimestamp = re.get('targetTimestamp');
      return targetSender?.id === senderId && targetTimestamp === sentAt;
    });

    if (reactionsBySource.length > 0) {
      log.info('Found early reaction for message');
      this.remove(reactionsBySource);
      return reactionsBySource;
    }

    return [];
  }

  private async findMessage(
    targetTimestamp: number,
    targetConversationId: string
  ): Promise<MessageAttributesType | undefined> {
    const messages = await window.Signal.Data.getMessagesBySentAt(
      targetTimestamp
    );

    return messages.find(m => {
      const contact = getContact(m);

      if (!contact) {
        return false;
      }

      const mcid = contact.get('id');
      return mcid === targetConversationId;
    });
  }

  async onReaction(
    reaction: ReactionModel,
    generatedMessage: MessageModel
  ): Promise<void> {
    try {
      // The conversation the target message was in; we have to find it in the database
      //   to to figure that out.
      const targetAuthorConversation =
        window.ConversationController.lookupOrCreate({
          uuid: reaction.get('targetAuthorUuid'),
        });
      const targetConversationId = targetAuthorConversation?.id;
      if (!targetConversationId) {
        throw new Error(
          'onReaction: No conversationId returned from lookupOrCreate!'
        );
      }

      const fromConversation = window.ConversationController.get(
        generatedMessage.get('conversationId')
      );

      let targetConversation: ConversationModel | undefined | null;

      const targetMessageCheck = await this.findMessage(
        reaction.get('targetTimestamp'),
        targetConversationId
      );
      if (!targetMessageCheck) {
        log.info(
          'No message for reaction',
          reaction.get('targetAuthorUuid'),
          reaction.get('targetTimestamp')
        );

        return;
      }

      if (
        fromConversation &&
        isStory(targetMessageCheck) &&
        isDirectConversation(fromConversation.attributes) &&
        !isMe(fromConversation.attributes)
      ) {
        targetConversation = fromConversation;
      } else {
        targetConversation =
          await window.ConversationController.getConversationForTargetMessage(
            targetConversationId,
            reaction.get('targetTimestamp')
          );
      }

      if (!targetConversation) {
        log.info(
          'No target conversation for reaction',
          reaction.get('targetAuthorUuid'),
          reaction.get('targetTimestamp')
        );
        return undefined;
      }

      // awaiting is safe since `onReaction` is never called from inside the queue
      await targetConversation.queueJob('Reactions.onReaction', async () => {
        log.info('Handling reaction for', reaction.get('targetTimestamp'));

        // Thanks TS.
        if (!targetConversation) {
          return;
        }

        // Message is fetched inside the conversation queue so we have the
        // most recent data
        const targetMessage = await this.findMessage(
          reaction.get('targetTimestamp'),
          targetConversationId
        );

        if (!targetMessage) {
          return;
        }

        const message = window.MessageController.register(
          targetMessage.id,
          targetMessage
        );

        // Use the generated message in ts/background.ts to create a message
        // if the reaction is targetted at a story on a 1:1 conversation.
        if (
          isStory(targetMessage) &&
          isDirectConversation(targetConversation.attributes)
        ) {
          generatedMessage.set({
            storyId: targetMessage.id,
            storyReactionEmoji: reaction.get('emoji'),
          });

          const [generatedMessageId] = await Promise.all([
            window.Signal.Data.saveMessage(generatedMessage.attributes, {
              ourUuid: window.textsecure.storage.user
                .getCheckedUuid()
                .toString(),
            }),
            generatedMessage.hydrateStoryContext(message),
          ]);

          generatedMessage.set({ id: generatedMessageId });

          const messageToAdd = window.MessageController.register(
            generatedMessageId,
            generatedMessage
          );
          targetConversation.addSingleMessage(messageToAdd);
        }

        await message.handleReaction(reaction);

        this.remove(reaction);
      });
    } catch (error) {
      log.error(
        'Reactions.onReaction error:',
        error && error.stack ? error.stack : error
      );
    }
  }
}
