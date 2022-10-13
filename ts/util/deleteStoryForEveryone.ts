// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import type { StoryDataType } from '../state/ducks/stories';
import { DAY } from './durations';
import { StoryRecipientUpdateEvent } from '../textsecure/messageReceiverEvents';
import { getSendOptions } from './getSendOptions';
import { onStoryRecipientUpdate } from './onStoryRecipientUpdate';
import { sendDeleteForEveryoneMessage } from './sendDeleteForEveryoneMessage';

export async function deleteStoryForEveryone(
  stories: Array<StoryDataType>,
  story: StoryDataType
): Promise<void> {
  if (!story.sendStateByConversationId) {
    return;
  }

  const conversationIds = new Set(Object.keys(story.sendStateByConversationId));
  const updatedStoryRecipients = new Map<
    string,
    {
      distributionListIds: Set<string>;
      isAllowedToReply: boolean;
    }
  >();

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();

  // Remove ourselves from the DOE.
  conversationIds.delete(ourConversation.id);

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

      const destinationUuid =
        window.ConversationController.get(conversationId)?.get('uuid');

      if (!destinationUuid) {
        return;
      }

      const distributionListIds =
        updatedStoryRecipients.get(destinationUuid)?.distributionListIds ||
        new Set();

      // These are the remaining distribution list ids that the user has
      // access to.
      updatedStoryRecipients.set(destinationUuid, {
        distributionListIds: item.storyDistributionListId
          ? new Set([...distributionListIds, item.storyDistributionListId])
          : distributionListIds,
        isAllowedToReply:
          sendStateByConversationId[conversationId].isAllowedToReplyToStory !==
          false,
      });

      // Remove this conversationId so we don't send the DOE to those that
      // still have access.
      conversationIds.delete(conversationId);
    });
  });

  // Send the DOE
  conversationIds.forEach(cid => {
    // Don't DOE yourself!
    if (cid === ourConversation.id) {
      return;
    }

    const conversation = window.ConversationController.get(cid);

    if (!conversation) {
      return;
    }

    sendDeleteForEveryoneMessage(conversation.attributes, {
      deleteForEveryoneDuration: DAY,
      id: story.messageId,
      timestamp: story.timestamp,
    });
  });

  // If it's the last story sent to a distribution list we don't have to send
  // the sync message, but to be consistent let's build up the updated
  // storyMessageRecipients and send the sync message.
  if (!updatedStoryRecipients.size) {
    Object.entries(story.sendStateByConversationId).forEach(
      ([recipientId, sendState]) => {
        if (recipientId === ourConversation.id) {
          return;
        }

        const destinationUuid =
          window.ConversationController.get(recipientId)?.get('uuid');

        if (!destinationUuid) {
          return;
        }

        updatedStoryRecipients.set(destinationUuid, {
          distributionListIds: new Set(),
          isAllowedToReply: sendState.isAllowedToReplyToStory !== false,
        });
      }
    );
  }

  // Send the sync message with the updated storyMessageRecipients list
  const sender = window.textsecure.messaging;
  if (sender) {
    const options = await getSendOptions(ourConversation.attributes, {
      syncMessage: true,
    });

    const storyMessageRecipients: Array<{
      destinationUuid: string;
      distributionListIds: Array<string>;
      isAllowedToReply: boolean;
    }> = [];

    updatedStoryRecipients.forEach((recipientData, destinationUuid) => {
      storyMessageRecipients.push({
        destinationUuid,
        distributionListIds: Array.from(recipientData.distributionListIds),
        isAllowedToReply: recipientData.isAllowedToReply,
      });
    });

    const destinationUuid = ourConversation.get('uuid');

    if (!destinationUuid) {
      return;
    }

    // Sync message for other devices
    sender.sendSyncMessage({
      destination: undefined,
      destinationUuid,
      storyMessageRecipients,
      expirationStartTimestamp: null,
      isUpdate: true,
      options,
      timestamp: story.timestamp,
      urgent: false,
    });

    // Sync message for Desktop
    const ev = new StoryRecipientUpdateEvent(
      {
        destinationUuid,
        timestamp: story.timestamp,
        storyMessageRecipients,
      },
      noop
    );
    onStoryRecipientUpdate(ev);
  }
}
