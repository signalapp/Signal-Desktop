// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type { MessageAttributesType } from '../model-types.d';
import type { SendStateByConversationId } from '../messages/MessageSendState';
import type { UUIDStringType } from '../types/UUID';
import * as log from '../logging/log';
import dataInterface from '../sql/Client';
import { DAY, SECOND } from './durations';
import { MY_STORIES_ID } from '../types/Stories';
import { ReadStatus } from '../messages/MessageReadStatus';
import { SeenStatus } from '../MessageSeenStatus';
import { SendStatus } from '../messages/MessageSendState';
import { UUID } from '../types/UUID';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { formatJobForInsert } from '../jobs/formatJobForInsert';
import { getRecipients } from './getRecipients';
import { getSignalConnections } from './getSignalConnections';
import { incrementMessageCounter } from './incrementMessageCounter';
import { isGroupV2 } from './whatTypeOfConversation';
import { isNotNil } from './isNotNil';

export async function sendStoryMessage(
  listIds: Array<string>,
  conversationIds: Array<string>,
  attachment: AttachmentType
): Promise<void> {
  const { messaging } = window.textsecure;

  if (!messaging) {
    log.warn('stories.sendStoryMessage: messaging not available');
    return;
  }

  const distributionLists = (
    await Promise.all(
      listIds.map(listId =>
        dataInterface.getStoryDistributionWithMembers(listId)
      )
    )
  ).filter(isNotNil);

  if (!distributionLists.length && !conversationIds.length) {
    log.warn(
      'stories.sendStoryMessage: Dropping send. no conversations to send to and no distribution lists found for',
      listIds
    );
    return;
  }

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();

  const timestamp = Date.now();

  const sendStateByListId = new Map<
    UUIDStringType,
    SendStateByConversationId
  >();

  const recipientsAlreadySentTo = new Map<UUIDStringType, boolean>();

  // * Create the custom sendStateByConversationId for each distribution list
  // * De-dupe members to make sure they're only sent to once
  // * Figure out who can reply/who can't
  distributionLists
    .sort(list => (list.allowsReplies ? -1 : 1))
    .forEach(distributionList => {
      const sendStateByConversationId: SendStateByConversationId = {};

      let distributionListMembers: Array<UUIDStringType> = [];

      if (
        distributionList.id === MY_STORIES_ID &&
        distributionList.isBlockList
      ) {
        const inBlockList = new Set<UUIDStringType>(distributionList.members);
        distributionListMembers = getSignalConnections().reduce(
          (acc, convo) => {
            const id = convo.get('uuid');
            if (!id) {
              return acc;
            }

            const uuid = UUID.cast(id);
            if (inBlockList.has(uuid)) {
              return acc;
            }

            acc.push(uuid);
            return acc;
          },
          [] as Array<UUIDStringType>
        );
      } else {
        distributionListMembers = distributionList.members;
      }

      distributionListMembers.forEach(destinationUuid => {
        const conversation = window.ConversationController.get(destinationUuid);
        if (!conversation) {
          return;
        }
        sendStateByConversationId[conversation.id] = {
          isAllowedToReplyToStory:
            recipientsAlreadySentTo.get(destinationUuid) ||
            distributionList.allowsReplies,
          isAlreadyIncludedInAnotherDistributionList:
            recipientsAlreadySentTo.has(destinationUuid),
          status: SendStatus.Pending,
          updatedAt: timestamp,
        };

        if (!recipientsAlreadySentTo.has(destinationUuid)) {
          recipientsAlreadySentTo.set(
            destinationUuid,
            distributionList.allowsReplies
          );
        }
      });

      sendStateByListId.set(distributionList.id, sendStateByConversationId);
    });

  const attachments: Array<AttachmentType> = [attachment];

  // * Gather all the job data we'll be sending to the sendStory job
  // * Create the message for each distribution list
  const distributionListMessages: Array<MessageAttributesType> =
    await Promise.all(
      distributionLists.map(async distributionList => {
        const sendStateByConversationId = sendStateByListId.get(
          distributionList.id
        );

        if (!sendStateByConversationId) {
          log.warn(
            'stories.sendStoryMessage: No sendStateByConversationId for distribution list',
            distributionList.id
          );
        }

        return window.Signal.Migrations.upgradeMessageSchema({
          attachments,
          conversationId: ourConversation.id,
          expireTimer: DAY / SECOND,
          id: UUID.generate().toString(),
          readStatus: ReadStatus.Read,
          received_at: incrementMessageCounter(),
          received_at_ms: timestamp,
          seenStatus: SeenStatus.NotApplicable,
          sendStateByConversationId,
          sent_at: timestamp,
          source: window.textsecure.storage.user.getNumber(),
          sourceUuid: window.textsecure.storage.user.getUuid()?.toString(),
          storyDistributionListId: distributionList.id,
          timestamp,
          type: 'story',
        });
      })
    );

  const groupV2MessagesByConversationId = new Map<
    string,
    MessageAttributesType
  >();

  await Promise.all(
    conversationIds.map(async conversationId => {
      const group = window.ConversationController.get(conversationId);

      if (!group) {
        log.warn(
          'stories.sendStoryMessage: No group found for id',
          conversationId
        );
        return;
      }

      if (!isGroupV2(group.attributes)) {
        log.warn(
          'stories.sendStoryMessage: Conversation we tried to send to is not a groupV2',
          conversationId
        );
        return;
      }

      const myId = window.ConversationController.getOurConversationIdOrThrow();
      const sendState = {
        status: SendStatus.Pending,
        updatedAt: timestamp,
      };

      const sendStateByConversationId = getRecipients(group.attributes).reduce(
        (acc, id) => {
          const conversation = window.ConversationController.get(id);
          if (!conversation) {
            return acc;
          }

          return {
            ...acc,
            [conversation.id]: sendState,
          };
        },
        {
          [myId]: sendState,
        }
      );

      const messageAttributes =
        await window.Signal.Migrations.upgradeMessageSchema({
          attachments,
          conversationId,
          expireTimer: DAY / SECOND,
          id: UUID.generate().toString(),
          readStatus: ReadStatus.Read,
          received_at: incrementMessageCounter(),
          received_at_ms: timestamp,
          seenStatus: SeenStatus.NotApplicable,
          sendStateByConversationId,
          sent_at: timestamp,
          source: window.textsecure.storage.user.getNumber(),
          sourceUuid: window.textsecure.storage.user.getUuid()?.toString(),
          timestamp,
          type: 'story',
        });

      groupV2MessagesByConversationId.set(conversationId, messageAttributes);
    })
  );

  // For distribution lists:
  // * Save the message model
  // * Add the message to the conversation
  await Promise.all(
    distributionListMessages.map(messageAttributes => {
      const model = new window.Whisper.Message(messageAttributes);
      const message = window.MessageController.register(model.id, model);

      ourConversation.addSingleMessage(model, { isJustSent: true });

      log.info(`stories.sendStoryMessage: saving message ${message.id}`);
      return dataInterface.saveMessage(message.attributes, {
        forceSave: true,
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      });
    })
  );

  // * Send to the distribution lists
  // * Place into job queue
  // * Save the job
  await conversationJobQueue.add(
    {
      type: conversationQueueJobEnum.enum.Story,
      conversationId: ourConversation.id,
      messageIds: distributionListMessages.map(m => m.id),
      timestamp,
    },
    async jobToInsert => {
      log.info(`stories.sendStoryMessage: saving job ${jobToInsert.id}`);
      await dataInterface.insertJob(formatJobForInsert(jobToInsert));
    }
  );

  // * Send to groups
  // * Save the message models
  // * Add message to group conversation
  await Promise.all(
    conversationIds.map(conversationId => {
      const messageAttributes =
        groupV2MessagesByConversationId.get(conversationId);

      if (!messageAttributes) {
        log.warn(
          'stories.sendStoryMessage: Trying to send a group story but it did not exist? This is unexpected. Not sending.',
          conversationId
        );
        return;
      }

      return conversationJobQueue.add(
        {
          type: conversationQueueJobEnum.enum.Story,
          conversationId,
          messageIds: [messageAttributes.id],
          timestamp,
        },
        async jobToInsert => {
          const model = new window.Whisper.Message(messageAttributes);
          const message = window.MessageController.register(model.id, model);

          const conversation = message.getConversation();
          conversation?.addSingleMessage(model, { isJustSent: true });

          log.info(`stories.sendStoryMessage: saving message ${message.id}`);
          await dataInterface.saveMessage(message.attributes, {
            forceSave: true,
            jobToInsert,
            ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
          });
        }
      );
    })
  );
}
