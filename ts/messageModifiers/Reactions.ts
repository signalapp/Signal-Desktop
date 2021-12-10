// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { Collection, Model } from 'backbone';
import type { MessageModel } from '../models/messages';
import { getContactId, getContact } from '../messages/helpers';
import { isOutgoing } from '../state/selectors/message';
import type { ReactionAttributesType } from '../model-types.d';
import * as log from '../logging/log';

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
      const targetSenderId = window.ConversationController.ensureContactIds({
        uuid: re.get('targetAuthorUuid'),
      });
      const targetTimestamp = re.get('targetTimestamp');
      return targetSenderId === senderId && targetTimestamp === sentAt;
    });

    if (reactionsBySource.length > 0) {
      log.info('Found early reaction for message');
      this.remove(reactionsBySource);
      return reactionsBySource;
    }

    return [];
  }

  async onReaction(reaction: ReactionModel): Promise<void> {
    try {
      // The conversation the target message was in; we have to find it in the database
      //   to to figure that out.
      const targetConversationId =
        window.ConversationController.ensureContactIds({
          uuid: reaction.get('targetAuthorUuid'),
        });
      if (!targetConversationId) {
        throw new Error(
          'onReaction: No conversationId returned from ensureContactIds!'
        );
      }

      const targetConversation =
        await window.ConversationController.getConversationForTargetMessage(
          targetConversationId,
          reaction.get('targetTimestamp')
        );
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

        const messages = await window.Signal.Data.getMessagesBySentAt(
          reaction.get('targetTimestamp')
        );
        // Message is fetched inside the conversation queue so we have the
        // most recent data
        const targetMessage = messages.find(m => {
          const contact = getContact(m);

          if (!contact) {
            return false;
          }

          const mcid = contact.get('id');
          const recid = window.ConversationController.ensureContactIds({
            uuid: reaction.get('targetAuthorUuid'),
          });
          return mcid === recid;
        });

        if (!targetMessage) {
          log.info(
            'No message for reaction',
            reaction.get('targetAuthorUuid'),
            reaction.get('targetTimestamp')
          );

          // Since we haven't received the message for which we are removing a
          // reaction, we can just remove those pending reactions
          if (reaction.get('remove')) {
            this.remove(reaction);
            const oldReaction = this.where({
              targetAuthorUuid: reaction.get('targetAuthorUuid'),
              targetTimestamp: reaction.get('targetTimestamp'),
              emoji: reaction.get('emoji'),
            });
            oldReaction.forEach(r => this.remove(r));
          }

          return;
        }

        const message = window.MessageController.register(
          targetMessage.id,
          targetMessage
        );

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
