// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';
import type { MessageAttributesType } from '../model-types.d';
import type { StoryDataType } from '../state/ducks/stories';
import * as log from '../logging/log';
import dataInterface from '../sql/Client';
import { getAttachmentsForMessage } from '../state/selectors/message';
import { isNotNil } from '../util/isNotNil';
import { strictAssert } from '../util/assert';

let storyData: Array<MessageAttributesType> | undefined;

export async function loadStories(): Promise<void> {
  storyData = await dataInterface.getOlderStories({});
}

export function getStoryDataFromMessageAttributes(
  message: MessageAttributesType,
  ourConversationId?: string
): StoryDataType | undefined {
  const { attachments } = message;
  const unresolvedAttachment = attachments ? attachments[0] : undefined;
  if (!unresolvedAttachment) {
    log.warn(
      `getStoryDataFromMessageAttributes: ${message.id} does not have an attachment`
    );
    return;
  }

  const [attachment] = unresolvedAttachment.path
    ? getAttachmentsForMessage(message)
    : [unresolvedAttachment];

  const selectedReaction = (
    (message.reactions || []).find(re => re.fromId === ourConversationId) || {}
  ).emoji;

  return {
    attachment,
    messageId: message.id,
    selectedReaction,
    ...pick(message, [
      'conversationId',
      'deletedForEveryone',
      'readStatus',
      'sendStateByConversationId',
      'source',
      'sourceUuid',
      'timestamp',
      'type',
    ]),
  };
}

export function getStoriesForRedux(): Array<StoryDataType> {
  strictAssert(storyData, 'storyData has not been loaded');

  const ourConversationId =
    window.ConversationController.getOurConversationId();

  const stories = storyData
    .map(story => getStoryDataFromMessageAttributes(story, ourConversationId))
    .filter(isNotNil);

  storyData = undefined;

  return stories;
}

export async function repairUnexpiredStories(): Promise<void> {
  if (!storyData) {
    await loadStories();
  }

  strictAssert(storyData, 'Could not load stories');

  const storiesWithExpiry = storyData
    .filter(story => !story.expirationStartTimestamp)
    .map(story => ({
      ...story,
      expirationStartTimestamp: Math.min(
        story.serverTimestamp || story.timestamp,
        Date.now()
      ),
    }));

  log.info(
    'repairUnexpiredStories: repairing number of stories',
    storiesWithExpiry.length
  );

  await Promise.all(
    storiesWithExpiry.map(messageAttributes => {
      return window.Signal.Data.saveMessage(messageAttributes, {
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      });
    })
  );
}
