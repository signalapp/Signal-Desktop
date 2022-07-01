// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';
import type { MessageAttributesType } from '../model-types.d';
import type { StoryDataType } from '../state/ducks/stories';
import * as durations from '../util/durations';
import * as log from '../logging/log';
import dataInterface from '../sql/Client';
import { getAttachmentsForMessage } from '../state/selectors/message';
import { isNotNil } from '../util/isNotNil';
import { strictAssert } from '../util/assert';

let storyData: Array<MessageAttributesType> | undefined;

export async function loadStories(): Promise<void> {
  storyData = await dataInterface.getOlderStories({});
  await repairUnexpiredStories();
}

export function getStoryDataFromMessageAttributes(
  message: MessageAttributesType
): StoryDataType | undefined {
  const { attachments, deletedForEveryone } = message;
  const unresolvedAttachment = attachments ? attachments[0] : undefined;
  if (!unresolvedAttachment && !deletedForEveryone) {
    log.warn(
      `getStoryDataFromMessageAttributes: ${message.id} does not have an attachment`
    );
    return;
  }

  const [attachment] =
    unresolvedAttachment && unresolvedAttachment.path
      ? getAttachmentsForMessage(message)
      : [unresolvedAttachment];

  return {
    attachment,
    messageId: message.id,
    ...pick(message, [
      'canReplyToStory',
      'conversationId',
      'deletedForEveryone',
      'reactions',
      'readStatus',
      'sendStateByConversationId',
      'source',
      'sourceUuid',
      'storyDistributionListId',
      'timestamp',
      'type',
    ]),
  };
}

export function getStoriesForRedux(): Array<StoryDataType> {
  strictAssert(storyData, 'storyData has not been loaded');

  const stories = storyData
    .map(getStoryDataFromMessageAttributes)
    .filter(isNotNil);

  storyData = undefined;

  return stories;
}

async function repairUnexpiredStories(): Promise<void> {
  strictAssert(storyData, 'Could not load stories');

  const DAY_AS_SECONDS = durations.DAY / 1000;

  const storiesWithExpiry = storyData
    .filter(
      story =>
        !story.expirationStartTimestamp ||
        !story.expireTimer ||
        story.expireTimer > DAY_AS_SECONDS
    )
    .map(story => ({
      ...story,
      expirationStartTimestamp: Math.min(
        story.serverTimestamp || story.timestamp,
        Date.now()
      ),
      expireTimer: Math.min(
        Math.floor((story.timestamp + durations.DAY - Date.now()) / 1000),
        DAY_AS_SECONDS
      ),
    }));

  if (!storiesWithExpiry.length) {
    return;
  }

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
