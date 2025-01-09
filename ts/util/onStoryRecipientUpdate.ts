// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';
import { DataReader } from '../sql/Client';
import type { StoryRecipientUpdateEvent } from '../textsecure/messageReceiverEvents';
import { normalizeServiceId } from '../types/ServiceId';
import { normalizeStoryDistributionId } from '../types/StoryDistributionId';
import * as log from '../logging/log';
import { SendStatus } from '../messages/MessageSendState';
import { getConversationIdForLogging } from './idForLogging';
import { isStory } from '../state/selectors/message';
import { queueUpdateMessage } from './messageBatcher';
import { isMe } from './whatTypeOfConversation';
import { drop } from './drop';
import { handleDeleteForEveryone } from './deleteForEveryone';
import { MessageModel } from '../models/messages';

export async function onStoryRecipientUpdate(
  event: StoryRecipientUpdateEvent
): Promise<void> {
  const { data, confirm } = event;

  const { destinationServiceId, timestamp } = data;

  const conversation = window.ConversationController.get(destinationServiceId);

  const logId = `onStoryRecipientUpdate(${destinationServiceId}, ${timestamp})`;

  if (!conversation) {
    log.warn(`${logId}: no conversation`);
    return;
  }

  if (!isMe(conversation.attributes)) {
    log.warn(`${logId}: story recipient update on invalid conversation`);
    return;
  }

  const targetConversation =
    await window.ConversationController.getConversationForTargetMessage(
      conversation.id,
      timestamp
    );

  if (!targetConversation) {
    log.info(`${logId}: no targetConversation`);
    return;
  }

  drop(
    targetConversation.queueJob(logId, async () => {
      log.info(`${logId}: updating`);

      // Build up some maps for fast/easy lookups
      const isAllowedToReply = new Map<string, boolean>();
      const distributionListIdToConversationIds = new Map<
        string,
        Set<string>
      >();
      data.storyMessageRecipients.forEach(item => {
        const { destinationServiceId: recipientServiceId } = item;

        if (!recipientServiceId) {
          return;
        }

        const convo = window.ConversationController.get(
          normalizeServiceId(recipientServiceId, `${logId}.recipientServiceId`)
        );

        if (!convo || !item.distributionListIds) {
          return;
        }

        for (const rawUuid of item.distributionListIds) {
          const uuid = normalizeStoryDistributionId(
            rawUuid,
            `${logId}.distributionListId`
          );

          const existing = distributionListIdToConversationIds.get(uuid);
          if (existing === undefined) {
            distributionListIdToConversationIds.set(uuid, new Set([convo.id]));
          } else {
            existing.add(convo.id);
          }
        }
        isAllowedToReply.set(convo.id, item.isAllowedToReply !== false);
      });

      const ourConversationId =
        window.ConversationController.getOurConversationIdOrThrow();
      const now = Date.now();

      const messages = await DataReader.getMessagesBySentAt(timestamp);

      // Now we figure out who needs to be added and who needs to removed
      const handledMessages = messages.filter(item => {
        if (!isStory(item)) {
          return false;
        }

        const { sendStateByConversationId, storyDistributionListId } = item;

        if (!sendStateByConversationId || !storyDistributionListId) {
          return false;
        }

        const newConversationIds =
          distributionListIdToConversationIds.get(storyDistributionListId) ??
          new Set();

        const nextSendStateByConversationId = {
          ...sendStateByConversationId,
        };

        // Find conversation ids present in the local send state, but missing
        // in the remote state, and remove them from the local state.
        for (const oldId of Object.keys(sendStateByConversationId)) {
          if (!newConversationIds.has(oldId)) {
            const recipient = window.ConversationController.get(oldId);

            const recipientLogId = recipient
              ? getConversationIdForLogging(recipient.attributes)
              : oldId;

            log.info(`${logId}: removing`, {
              recipient: recipientLogId,
              messageId: item.id,
              storyDistributionListId,
            });
            delete nextSendStateByConversationId[oldId];
          }
        }

        // Find conversation ids present in the remote send state, but missing in
        // the local send state, and add them to the local state.
        for (const newId of newConversationIds) {
          if (sendStateByConversationId[newId] === undefined) {
            const recipient = window.ConversationController.get(newId);

            const recipientLogId = recipient
              ? getConversationIdForLogging(recipient.attributes)
              : newId;

            log.info(`${logId}: adding`, {
              recipient: recipientLogId,
              messageId: item.id,
              storyDistributionListId,
            });
            nextSendStateByConversationId[newId] = {
              isAllowedToReplyToStory: Boolean(isAllowedToReply.get(newId)),
              status: SendStatus.Sent,
              updatedAt: now,
            };
          }
        }

        if (isEqual(sendStateByConversationId, nextSendStateByConversationId)) {
          log.info(`${logId}: sendStateByConversationId does not need update`, {
            messageId: item.id,
          });
          return true;
        }

        const message = window.MessageCache.register(new MessageModel(item));

        const sendStateConversationIds = new Set(
          Object.keys(nextSendStateByConversationId)
        );

        if (
          sendStateConversationIds.size === 0 ||
          (sendStateConversationIds.size === 1 &&
            sendStateConversationIds.has(ourConversationId))
        ) {
          log.info(`${logId} DOE`, {
            messageId: item.id,
            storyDistributionListId,
          });

          // There are no longer any remaining members for this message so lets
          // run it through deleteForEveryone which marks the message as
          // deletedForEveryone locally.
          //
          // NOTE: We don't call `Deletes.onDelete()` so the message lookup by
          // sent timestamp doesn't happen (it would return all copies of the
          // story, not just the one we want to delete).
          drop(
            handleDeleteForEveryone(message, {
              fromId: ourConversationId,
              serverTimestamp: Number(item.serverTimestamp),
              targetSentTimestamp: item.timestamp,
            })
          );
        } else {
          message.set({
            sendStateByConversationId: nextSendStateByConversationId,
          });
          queueUpdateMessage(message.attributes);
        }

        return true;
      });

      if (handledMessages.length) {
        window.Whisper.events.trigger('incrementProgress');
        confirm();
      }
    })
  );
}
