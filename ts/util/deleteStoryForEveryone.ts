// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';

import type { ConversationQueueJobData } from '../jobs/conversationJobQueue';
import type { StoryDataType } from '../state/ducks/stories';
import * as Errors from '../types/errors';
import type { StoryMessageRecipientsType } from '../types/Stories';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type { ServiceIdString } from '../types/ServiceId';
import * as log from '../logging/log';
import { DAY } from './durations';
import { StoryRecipientUpdateEvent } from '../textsecure/messageReceiverEvents';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { onStoryRecipientUpdate } from './onStoryRecipientUpdate';
import { sendDeleteForEveryoneMessage } from './sendDeleteForEveryoneMessage';
import { isGroupV2 } from './whatTypeOfConversation';
import { getMessageById } from '../messages/getMessageById';
import { strictAssert } from './assert';
import { repeat, zipObject } from './iterables';
import { isOlderThan } from './timestamp';

export async function deleteStoryForEveryone(
  stories: ReadonlyArray<StoryDataType>,
  story: StoryDataType
): Promise<void> {
  if (!story.sendStateByConversationId) {
    return;
  }

  // Group stories are deleted as regular messages.
  const sourceConversation = window.ConversationController.get(
    story.conversationId
  );
  if (sourceConversation && isGroupV2(sourceConversation.attributes)) {
    void sendDeleteForEveryoneMessage(sourceConversation.attributes, {
      deleteForEveryoneDuration: DAY,
      id: story.messageId,
      timestamp: story.timestamp,
    });
    return;
  }

  const logId = `deleteStoryForEveryone(${story.messageId})`;
  const message = await getMessageById(story.messageId);
  if (!message) {
    throw new Error('Story not found');
  }

  if (isOlderThan(story.timestamp, DAY)) {
    throw new Error('Cannot send DOE for a story older than one day');
  }

  const conversationIds = new Set(Object.keys(story.sendStateByConversationId));
  const newStoryRecipients = new Map<
    ServiceIdString,
    {
      distributionListIds: Set<StoryDistributionIdString>;
      isAllowedToReply: boolean;
    }
  >();

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();

  // Remove ourselves from the DOE.
  conversationIds.delete(ourConversation.id);

  // `updatedStoryRecipients` is used to build `storyMessageRecipients` for
  // a sync message. Put all affected destinationServiceIds early on so that if
  // there are no other distribution lists for them - we'd still include an
  // empty list.
  Object.entries(story.sendStateByConversationId).forEach(
    ([recipientId, sendState]) => {
      if (recipientId === ourConversation.id) {
        return;
      }

      const destinationServiceId =
        window.ConversationController.get(recipientId)?.getServiceId();

      if (!destinationServiceId) {
        return;
      }

      newStoryRecipients.set(destinationServiceId, {
        distributionListIds: new Set(),
        isAllowedToReply: sendState.isAllowedToReplyToStory !== false,
      });
    }
  );

  // Find stories that were sent to other distribution lists so that we don't
  // send a DOE request to the members of those lists.
  stories.forEach(item => {
    const { sendStateByConversationId } = item;
    // We only want matching timestamp stories which are stories that were
    // sent to multi distribution lists.
    // We don't want the story we just passed in.
    // Don't need to check for stories that have already been deleted.
    // And only for sent stories, not incoming.
    if (
      item.timestamp !== story.timestamp ||
      item.messageId === story.messageId ||
      item.deletedForEveryone ||
      !sendStateByConversationId
    ) {
      return;
    }

    Object.keys(sendStateByConversationId).forEach(conversationId => {
      if (conversationId === ourConversation.id) {
        return;
      }

      const destinationServiceId =
        window.ConversationController.get(conversationId)?.getServiceId();

      if (!destinationServiceId) {
        return;
      }

      // Remove this conversationId so we don't send the DOE to those that
      // still have access.
      conversationIds.delete(conversationId);

      // Build remaining distribution list ids that the user still has
      // access to.
      if (item.storyDistributionListId === undefined) {
        return;
      }

      // Build complete list of new story recipients (not counting ones that
      // are in the deleted story).
      let recipient = newStoryRecipients.get(destinationServiceId);
      if (!recipient) {
        const isAllowedToReply =
          sendStateByConversationId[conversationId].isAllowedToReplyToStory;
        recipient = {
          distributionListIds: new Set(),
          isAllowedToReply: isAllowedToReply !== false,
        };

        newStoryRecipients.set(destinationServiceId, recipient);
      }

      recipient.distributionListIds.add(item.storyDistributionListId);
    });
  });

  // Include the sync message with the updated storyMessageRecipients list
  const sender = window.textsecure.messaging;
  strictAssert(sender, 'messaging has to be initialized');

  const newStoryMessageRecipients: StoryMessageRecipientsType = [];

  newStoryRecipients.forEach((recipientData, destinationServiceId) => {
    newStoryMessageRecipients.push({
      destinationServiceId,
      distributionListIds: Array.from(recipientData.distributionListIds),
      isAllowedToReply: recipientData.isAllowedToReply,
    });
  });

  const destinationServiceId = ourConversation.getCheckedServiceId(
    'deleteStoryForEveryone'
  );

  log.info(`${logId}: sending DOE to ${conversationIds.size} conversations`);

  message.set({
    deletedForEveryoneSendStatus: zipObject(conversationIds, repeat(false)),
  });

  // Send the DOE
  log.info(`${logId}: enqueuing DeleteStoryForEveryone`);

  try {
    const jobData: ConversationQueueJobData = {
      type: conversationQueueJobEnum.enum.DeleteStoryForEveryone,
      conversationId: ourConversation.id,
      storyId: story.messageId,
      targetTimestamp: story.timestamp,
      updatedStoryRecipients: newStoryMessageRecipients,
    };
    await conversationJobQueue.add(jobData, async jobToInsert => {
      log.info(`${logId}: Deleting message with job ${jobToInsert.id}`);

      await window.MessageCache.saveMessage(message.attributes, {
        jobToInsert,
      });
    });
  } catch (error) {
    log.error(
      `${logId}: Failed to queue delete for everyone`,
      Errors.toLogFormat(error)
    );
    throw error;
  }

  log.info(`${logId}: emulating sync message event`);

  // Emulate message for Desktop (this will call deleteForEveryone())
  const ev = new StoryRecipientUpdateEvent(
    {
      destinationServiceId,
      timestamp: story.timestamp,
      storyMessageRecipients: newStoryMessageRecipients,
    },
    noop
  );
  void onStoryRecipientUpdate(ev);
}
