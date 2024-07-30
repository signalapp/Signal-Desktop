// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import omit from 'lodash/omit';
import * as log from '../logging/log';
import type { AttachmentType } from '../types/Attachment';
import type { MessageAttributesType } from '../model-types.d';
import { getAttachmentsForMessage } from '../state/selectors/message';
import { isAciString } from './isAciString';
import { isDirectConversation } from './whatTypeOfConversation';
import { softAssert, strictAssert } from './assert';
import { getMessageSentTimestamp } from './getMessageSentTimestamp';
import { isOlderThan } from './timestamp';
import { DAY } from './durations';

export async function hydrateStoryContext(
  messageId: string,
  storyMessageParam?: MessageAttributesType,
  {
    shouldSave,
    isStoryErased,
  }: {
    shouldSave?: boolean;
    isStoryErased?: boolean;
  } = {}
): Promise<Partial<MessageAttributesType> | undefined> {
  let messageAttributes: MessageAttributesType;
  try {
    messageAttributes = await window.MessageCache.resolveAttributes(
      'hydrateStoryContext',
      messageId
    );
  } catch {
    return undefined;
  }

  const { storyId } = messageAttributes;
  if (!storyId) {
    return undefined;
  }

  const { storyReplyContext: context } = messageAttributes;
  const sentTimestamp = getMessageSentTimestamp(messageAttributes, {
    includeEdits: false,
    log,
  });
  const olderThanADay = isOlderThan(sentTimestamp, DAY);
  const didNotFindMessage = context && !context.messageId;
  const weHaveData = context && context.attachment?.url;

  if (
    !isStoryErased &&
    ((!olderThanADay && weHaveData) || (olderThanADay && didNotFindMessage))
  ) {
    return undefined;
  }

  let storyMessage: MessageAttributesType | undefined;
  try {
    storyMessage =
      storyMessageParam === undefined
        ? await window.MessageCache.resolveAttributes(
            'hydrateStoryContext/story',
            storyId
          )
        : window.MessageCache.toMessageAttributes(storyMessageParam);
  } catch {
    storyMessage = undefined;
  }

  if (!storyMessage || isStoryErased) {
    const conversation = window.ConversationController.get(
      messageAttributes.conversationId
    );
    softAssert(
      conversation && isDirectConversation(conversation.attributes),
      'hydrateStoryContext: Not a type=direct conversation'
    );
    const newMessageAttributes: Partial<MessageAttributesType> = {
      storyReplyContext: {
        ...context,
        attachment: undefined,
        // No messageId = referenced story not found
        messageId: '',
      },
    };
    if (shouldSave) {
      await window.MessageCache.setAttributes({
        messageId,
        messageAttributes: newMessageAttributes,
        skipSaveToDatabase: false,
      });
    } else {
      window.MessageCache.setAttributes({
        messageId,
        messageAttributes: newMessageAttributes,
        skipSaveToDatabase: true,
      });
    }

    return newMessageAttributes;
  }

  const attachments = getAttachmentsForMessage({ ...storyMessage });
  let attachment: AttachmentType | undefined = attachments?.[0];
  if (attachment && !attachment.url && !attachment.textAttachment) {
    attachment = undefined;
  }

  const { sourceServiceId: authorAci } = storyMessage;
  strictAssert(isAciString(authorAci), 'Story message from pni');
  const newMessageAttributes: Partial<MessageAttributesType> = {
    storyReplyContext: {
      attachment: attachment ? omit(attachment, 'screenshotData') : undefined,
      authorAci,
      messageId: storyMessage.id,
    },
  };
  if (shouldSave) {
    await window.MessageCache.setAttributes({
      messageId,
      messageAttributes: newMessageAttributes,
      skipSaveToDatabase: false,
    });
  } else {
    window.MessageCache.setAttributes({
      messageId,
      messageAttributes: newMessageAttributes,
      skipSaveToDatabase: true,
    });
  }
  return newMessageAttributes;
}
