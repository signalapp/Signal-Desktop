// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import type { AttachmentType } from '../types/Attachment.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type {
  SendState,
  SendStateByConversationId,
} from '../messages/MessageSendState.std.js';
import type { StoryDistributionIdString } from '../types/StoryDistributionId.std.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { createLogger } from '../logging/log.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { MY_STORY_ID, StorySendMode } from '../types/Stories.std.js';
import { getStoriesBlocked } from './stories.preload.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import { SeenStatus } from '../MessageSeenStatus.std.js';
import { SendStatus } from '../messages/MessageSendState.std.js';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.js';
import { getRecipients } from './getRecipients.dom.js';
import { getSignalConnections } from './getSignalConnections.preload.js';
import { incrementMessageCounter } from './incrementMessageCounter.preload.js';
import { isGroupV2 } from './whatTypeOfConversation.dom.js';
import { isNotNil } from './isNotNil.std.js';
import { collect } from './iterables.std.js';
import { loadPreviewData, upgradeMessageSchema } from './migrations.preload.js';
import { DurationInSeconds } from './durations/index.std.js';
import { sanitizeLinkPreview } from '../services/LinkPreview.preload.js';
import type { DraftBodyRanges } from '../types/BodyRange.std.js';
import { MessageModel } from '../models/messages.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('sendStoryMessage');

export async function sendStoryMessage(
  listIds: Array<string>,
  conversationIds: Array<string>,
  attachment: AttachmentType,
  bodyRanges: DraftBodyRanges | undefined
): Promise<void> {
  if (getStoriesBlocked()) {
    log.warn('stories.sendStoryMessage: stories disabled, returning early');
    return;
  }

  const distributionLists = (
    await Promise.all(
      listIds.map(listId => DataReader.getStoryDistributionWithMembers(listId))
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
    StoryDistributionIdString,
    SendStateByConversationId
  >();

  const recipientsAlreadySentTo = new Map<ServiceIdString, boolean>();

  // * Create the custom sendStateByConversationId for each distribution list
  // * De-dupe members to make sure they're only sent to once
  // * Figure out who can reply/who can't
  distributionLists
    .sort(list => (list.allowsReplies ? -1 : 1))
    .forEach(distributionList => {
      const sendStateByConversationId: SendStateByConversationId = {};

      let distributionListMembers: Array<ServiceIdString> = [];

      if (distributionList.id === MY_STORY_ID && distributionList.isBlockList) {
        const inBlockList = new Set<ServiceIdString>(distributionList.members);
        distributionListMembers = getSignalConnections().reduce(
          (acc, convo) => {
            const uuid = convo.getServiceId();
            if (!uuid) {
              return acc;
            }

            if (inBlockList.has(uuid)) {
              return acc;
            }

            if (convo.isEverUnregistered()) {
              return acc;
            }

            acc.push(uuid);
            return acc;
          },
          [] as Array<ServiceIdString>
        );
      } else {
        distributionListMembers = distributionList.members;
      }

      distributionListMembers.forEach(destinationServiceId => {
        const conversation =
          window.ConversationController.get(destinationServiceId);
        if (!conversation) {
          return;
        }
        sendStateByConversationId[conversation.id] = {
          isAllowedToReplyToStory:
            recipientsAlreadySentTo.get(destinationServiceId) ||
            distributionList.allowsReplies,
          isAlreadyIncludedInAnotherDistributionList:
            recipientsAlreadySentTo.has(destinationServiceId),
          status: SendStatus.Pending,
          updatedAt: timestamp,
        };

        if (!recipientsAlreadySentTo.has(destinationServiceId)) {
          recipientsAlreadySentTo.set(
            destinationServiceId,
            distributionList.allowsReplies
          );
        }
      });

      sendStateByListId.set(distributionList.id, sendStateByConversationId);
    });

  const attachments: Array<AttachmentType> = [attachment];

  const linkPreview = attachment?.textAttachment?.preview;
  const sanitizedLinkPreview = linkPreview
    ? sanitizeLinkPreview((await loadPreviewData([linkPreview]))[0])
    : undefined;
  // If a text attachment has a link preview we remove it from the
  // textAttachment data structure and instead process the preview and add
  // it as a "preview" property for the message attributes.
  const preview = sanitizedLinkPreview ? [sanitizedLinkPreview] : undefined;

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

        // Note: we use the same sent_at for these messages because we want de-duplication
        //   on the receiver side.
        return upgradeMessageSchema({
          attachments,
          bodyRanges,
          conversationId: ourConversation.id,
          expireTimer: DurationInSeconds.DAY,
          expirationStartTimestamp: Date.now(),
          id: generateUuid(),
          preview,
          readStatus: ReadStatus.Read,
          received_at: incrementMessageCounter(),
          received_at_ms: timestamp,
          seenStatus: SeenStatus.NotApplicable,
          sendStateByConversationId,
          sent_at: timestamp,
          source: itemStorage.user.getNumber(),
          sourceServiceId: itemStorage.user.getAci(),
          sourceDevice: itemStorage.user.getDeviceId(),
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

  const groupsToSendTo = Array.from(
    collect(conversationIds, conversationId => {
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

      if (group.get('announcementsOnly') && !group.areWeAdmin()) {
        log.warn(
          'stories.sendStoryMessage: cannot send to an announcement only group as a non-admin',
          conversationId
        );
        return;
      }

      return group;
    })
  );

  // sending a story to a group marks it as one we want to always
  // include on the send-story-to list
  const groupsToUpdate = Array.from(groupsToSendTo).filter(
    group => group.getStorySendMode() !== StorySendMode.Always
  );
  for (const group of groupsToUpdate) {
    group.set({ storySendMode: StorySendMode.Always });
  }
  void DataWriter.updateConversations(
    groupsToUpdate.map(group => group.attributes)
  );
  for (const group of groupsToUpdate) {
    group.captureChange('storySendMode');
  }

  await Promise.all(
    groupsToSendTo.map(async (group, index) => {
      // We want all of these timestamps to be different from the My Story timestamp.
      const groupTimestamp = timestamp + index + 1;

      const myId = window.ConversationController.getOurConversationIdOrThrow();
      const sendState: SendState = {
        status: SendStatus.Pending,
        updatedAt: groupTimestamp,
        isAllowedToReplyToStory: true,
      };

      const sendStateByConversationId: SendStateByConversationId =
        getRecipients(group.attributes).reduce(
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

      const messageAttributes = await upgradeMessageSchema({
        attachments,
        bodyRanges,
        canReplyToStory: true,
        conversationId: group.id,
        expireTimer: DurationInSeconds.DAY,
        expirationStartTimestamp: Date.now(),
        id: generateUuid(),
        readStatus: ReadStatus.Read,
        received_at: incrementMessageCounter(),
        received_at_ms: groupTimestamp,
        seenStatus: SeenStatus.NotApplicable,
        sendStateByConversationId,
        sent_at: groupTimestamp,
        source: itemStorage.user.getNumber(),
        sourceServiceId: itemStorage.user.getAci(),
        sourceDevice: itemStorage.user.getDeviceId(),
        timestamp: groupTimestamp,
        type: 'story',
      });

      groupV2MessagesByConversationId.set(group.id, messageAttributes);
    })
  );

  // For distribution lists:
  // * Save the message model
  // * Add the message to the conversation
  await Promise.all(
    distributionListMessages.map(message => {
      window.MessageCache.register(new MessageModel(message));

      void ourConversation.addSingleMessage(message, { isJustSent: true });

      log.info(`stories.sendStoryMessage: saving message ${message.timestamp}`);
      return window.MessageCache.saveMessage(message, {
        forceSave: true,
      });
    })
  );

  // * Send to the distribution lists
  // * Place into job queue
  // * Save the job
  await conversationJobQueue.add({
    type: conversationQueueJobEnum.enum.Story,
    conversationId: ourConversation.id,
    messageIds: distributionListMessages.map(m => m.id),
    timestamp,
  });

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
          // using the group timestamp, which will differ from the 1:1 timestamp
          timestamp: messageAttributes.timestamp,
        },
        async jobToInsert => {
          window.MessageCache.register(new MessageModel(messageAttributes));
          const conversation =
            window.ConversationController.get(conversationId);
          void conversation?.addSingleMessage(messageAttributes, {
            isJustSent: true,
          });

          log.info(
            `stories.sendStoryMessage: saving message ${messageAttributes.timestamp}`
          );
          await window.MessageCache.saveMessage(messageAttributes, {
            forceSave: true,
            jobToInsert,
          });
        }
      );
    })
  );
}
