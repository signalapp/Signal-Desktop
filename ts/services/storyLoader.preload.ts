// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import type { StoryDataType } from '../state/ducks/stories.preload.js';
import * as durations from '../util/durations/index.std.js';
import { createLogger } from '../logging/log.std.js';
import { DataReader } from '../sql/Client.preload.js';
import type { GetAllStoriesResultType } from '../sql/Interface.std.js';
import {
  getAttachmentsForMessage,
  getPropsForAttachment,
} from '../state/selectors/message.preload.js';
import type { LinkPreviewType } from '../types/message/LinkPreviews.std.js';
import { isNotNil } from '../util/isNotNil.std.js';
import { strictAssert } from '../util/assert.std.js';
import { dropNull } from '../util/dropNull.std.js';
import { DurationInSeconds } from '../util/durations/index.std.js';
import { SIGNAL_ACI } from '../types/SignalConversation.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { pick } = lodash;

const log = createLogger('storyLoader');

let storyData: GetAllStoriesResultType | undefined;

export async function loadStories(): Promise<void> {
  storyData = await DataReader.getAllStories({});

  await repairUnexpiredStories();
}

export function getStoryDataFromMessageAttributes(
  message: ReadonlyMessageAttributesType &
    Readonly<{
      hasReplies?: boolean;
      hasRepliesFromSelf?: boolean;
    }>
): StoryDataType | undefined {
  const { attachments, deletedForEveryone } = message;
  const unresolvedAttachment = attachments ? attachments[0] : undefined;
  if (!unresolvedAttachment && !deletedForEveryone) {
    log.warn(
      `getStoryDataFromMessageAttributes: ${message.id} does not have an attachment`
    );
    return;
  }

  let [attachment] =
    unresolvedAttachment && unresolvedAttachment.path
      ? getAttachmentsForMessage(message)
      : [unresolvedAttachment];

  // If a story message has a preview property in its attributes then we
  // rebuild the textAttachment data structure to contain the all the data it
  // needs to fully render the text attachment including the link preview and
  // its image.
  let preview: LinkPreviewType | undefined;
  if (message.preview?.length) {
    strictAssert(
      message.preview.length === 1,
      'getStoryDataFromMessageAttributes: story can have only one preview'
    );
    [preview] = message.preview;

    strictAssert(
      attachment?.textAttachment,
      'getStoryDataFromMessageAttributes: story must have a ' +
        'textAttachment with preview'
    );
    attachment = {
      ...attachment,
      textAttachment: {
        ...attachment.textAttachment,
        preview: {
          ...preview,
          image:
            preview.image &&
            getPropsForAttachment(preview.image, 'preview', message),
        },
      },
    };
  } else if (attachment) {
    attachment = getPropsForAttachment(attachment, 'attachment', message);
  }

  // for a story, the message should always include the sourceDevice
  // but some messages got saved without one in the past (sync-sent)
  // we default those to some reasonable values that won't break the app
  let sourceDevice: number;
  if (message.sourceDevice !== undefined) {
    sourceDevice = message.sourceDevice;
  } else {
    log.error('getStoryDataFromMessageAttributes: undefined sourceDevice');
    // storage user.getDevice() should always produce a value after registration
    const ourDeviceId = itemStorage.user.getDeviceId() ?? -1;
    if (message.type === 'outgoing') {
      sourceDevice = ourDeviceId;
    } else if (message.type === 'incoming') {
      sourceDevice = 1;
    } else {
      sourceDevice = -1;
    }
  }

  return {
    attachment,
    messageId: message.id,
    ...pick(message, [
      'bodyRanges',
      'canReplyToStory',
      'conversationId',
      'deletedForEveryone',
      'hasReplies',
      'hasRepliesFromSelf',
      'reactions',
      'readAt',
      'readStatus',
      'sendStateByConversationId',
      'source',
      'sourceServiceId',
      'storyDistributionListId',
      'storyRecipientsVersion',
      'timestamp',
      'type',
    ]),
    sourceDevice,
    expireTimer: message.expireTimer,
    expirationStartTimestamp: dropNull(message.expirationStartTimestamp),
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

  const DAY_AS_SECONDS = DurationInSeconds.fromDays(1);

  const storiesWithExpiry = storyData
    .filter(
      story =>
        story.sourceServiceId !== SIGNAL_ACI &&
        (!story.expirationStartTimestamp ||
          !story.expireTimer ||
          story.expireTimer > DAY_AS_SECONDS)
    )
    .map(story => ({
      ...story,
      expirationStartTimestamp: Math.min(story.timestamp, Date.now()),
      expireTimer: DurationInSeconds.fromMillis(
        Math.min(
          Math.floor(story.timestamp + durations.DAY - Date.now()),
          durations.DAY
        )
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
      return window.MessageCache.saveMessage(messageAttributes);
    })
  );
}
