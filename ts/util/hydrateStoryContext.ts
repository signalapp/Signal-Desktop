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
import { getMessageById } from '../messages/getMessageById';
import { MessageModel } from '../models/messages';

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
  const message = await getMessageById(messageId);
  if (!message) {
    log.warn(`hydrateStoryContext: Message ${messageId} not found`);
    return undefined;
  }

  const { storyId, storyReplyContext: context } = message.attributes;
  if (!storyId) {
    return undefined;
  }

  const sentTimestamp = getMessageSentTimestamp(message.attributes, {
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

  let storyMessage: MessageModel | undefined;
  try {
    storyMessage =
      storyMessageParam === undefined
        ? await getMessageById(storyId)
        : window.MessageCache.register(new MessageModel(storyMessageParam));
  } catch {
    storyMessage = undefined;
  }

  if (!storyMessage || isStoryErased) {
    const conversation = window.ConversationController.get(
      message.attributes.conversationId
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
    message.set(newMessageAttributes);
    if (shouldSave) {
      await window.MessageCache.saveMessage(message.attributes);
    }

    return newMessageAttributes;
  }

  const attachments = getAttachmentsForMessage({ ...storyMessage.attributes });
  let attachment: AttachmentType | undefined = attachments?.[0];
  if (attachment && !attachment.url && !attachment.textAttachment) {
    attachment = undefined;
  }

  const { sourceServiceId: authorAci } = storyMessage.attributes;
  strictAssert(isAciString(authorAci), 'Story message from pni');
  const newMessageAttributes: Partial<MessageAttributesType> = {
    storyReplyContext: {
      attachment: attachment ? omit(attachment, 'screenshotData') : undefined,
      authorAci,
      messageId: storyMessage.id,
    },
  };
  message.set(newMessageAttributes);
  if (shouldSave) {
    await window.MessageCache.saveMessage(message.attributes);
  }

  return newMessageAttributes;
}
