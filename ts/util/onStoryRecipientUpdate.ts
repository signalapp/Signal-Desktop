// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';
import type { DeleteAttributesType } from '../messageModifiers/Deletes';
import type { StoryRecipientUpdateEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import { Deletes } from '../messageModifiers/Deletes';
import { SendStatus } from '../messages/MessageSendState';
import { deleteForEveryone } from './deleteForEveryone';
import {
  getConversationIdForLogging,
  getMessageIdForLogging,
} from './idForLogging';
import { isStory } from '../state/selectors/message';
import { normalizeUuid } from './normalizeUuid';
import { queueUpdateMessage } from './messageBatcher';

export async function onStoryRecipientUpdate(
  event: StoryRecipientUpdateEvent
): Promise<void> {
  const { data, confirm } = event;

  const { destinationUuid, timestamp } = data;

  const conversation = window.ConversationController.get(destinationUuid);

  if (!conversation) {
    return;
  }

  const targetConversation =
    await window.ConversationController.getConversationForTargetMessage(
      conversation.id,
      timestamp
    );

  if (!targetConversation) {
    log.info('onStoryRecipientUpdate !targetConversation', {
      destinationUuid,
      timestamp,
    });

    return;
  }

  targetConversation.queueJob('onStoryRecipientUpdate', async () => {
    log.info('onStoryRecipientUpdate updating', timestamp);

    // Build up some maps for fast/easy lookups
    const isAllowedToReply = new Map<string, boolean>();
    const conversationIdToDistributionListIds = new Map<string, Set<string>>();
    data.storyMessageRecipients.forEach(item => {
      const convo = window.ConversationController.get(item.destinationUuid);

      if (!convo || !item.distributionListIds) {
        return;
      }

      conversationIdToDistributionListIds.set(
        convo.id,
        new Set(
          item.distributionListIds.map(uuid =>
            normalizeUuid(uuid, 'onStoryRecipientUpdate.distributionListId')
          )
        )
      );
      isAllowedToReply.set(convo.id, item.isAllowedToReply !== false);
    });

    const ourConversationId =
      window.ConversationController.getOurConversationIdOrThrow();
    const now = Date.now();

    const messages = await window.Signal.Data.getMessagesBySentAt(timestamp);

    // Now we figure out who needs to be added and who needs to removed
    messages.forEach(item => {
      if (!isStory(item)) {
        return;
      }

      const { sendStateByConversationId, storyDistributionListId } = item;

      if (!sendStateByConversationId || !storyDistributionListId) {
        return;
      }

      const nextSendStateByConversationId = {
        ...sendStateByConversationId,
      };

      conversationIdToDistributionListIds.forEach(
        (distributionListIds, conversationId) => {
          const hasDistributionListId = distributionListIds.has(
            storyDistributionListId
          );

          const recipient = window.ConversationController.get(conversationId);
          const conversationIdForLogging = recipient
            ? getConversationIdForLogging(recipient.attributes)
            : conversationId;

          if (
            hasDistributionListId &&
            !sendStateByConversationId[conversationId]
          ) {
            log.info('onStoryRecipientUpdate adding', {
              conversationId: conversationIdForLogging,
              messageId: getMessageIdForLogging(item),
              storyDistributionListId,
            });
            nextSendStateByConversationId[conversationId] = {
              isAllowedToReplyToStory: Boolean(
                isAllowedToReply.get(conversationId)
              ),
              status: SendStatus.Sent,
              updatedAt: now,
            };
          } else if (
            sendStateByConversationId[conversationId] &&
            !hasDistributionListId
          ) {
            log.info('onStoryRecipientUpdate removing', {
              conversationId: conversationIdForLogging,
              messageId: getMessageIdForLogging(item),
              storyDistributionListId,
            });
            delete nextSendStateByConversationId[conversationId];
          }
        }
      );

      if (isEqual(sendStateByConversationId, nextSendStateByConversationId)) {
        log.info(
          'onStoryRecipientUpdate: sendStateByConversationId does not need update'
        );
        return;
      }

      const message = window.MessageController.register(item.id, item);

      const sendStateConversationIds = new Set(
        Object.keys(nextSendStateByConversationId)
      );

      if (
        sendStateConversationIds.size === 0 ||
        (sendStateConversationIds.size === 1 &&
          sendStateConversationIds.has(ourConversationId))
      ) {
        log.info('onStoryRecipientUpdate DOE', {
          messageId: getMessageIdForLogging(item),
          storyDistributionListId,
        });
        const delAttributes: DeleteAttributesType = {
          fromId: ourConversationId,
          serverTimestamp: Number(item.serverTimestamp),
          targetSentTimestamp: item.timestamp,
        };
        const doe = Deletes.getSingleton().add(delAttributes);
        // There are no longer any remaining members for this message so lets
        // run it through deleteForEveryone which marks the message as
        // deletedForEveryone locally.
        deleteForEveryone(message, doe);
      } else {
        message.set({
          sendStateByConversationId: nextSendStateByConversationId,
        });
        queueUpdateMessage(message.attributes);
      }
    });

    window.Whisper.events.trigger('incrementProgress');
    confirm();
  });
}
