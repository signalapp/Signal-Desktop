// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import omit from 'lodash/omit.js';
import { createLogger } from '../logging/log.std.ts';
import type { AttachmentType } from '../types/Attachment.std.ts';
import type { MessageAttributesType } from '../model-types.d.ts';
import { getAttachmentsForMessage } from '../state/selectors/message.preload.ts';
import { isAciString } from './isAciString.std.ts';
import { isDirectConversation } from './whatTypeOfConversation.dom.ts';
import { softAssert, strictAssert } from './assert.std.ts';
import { getMessageSentTimestamp } from './getMessageSentTimestamp.std.ts';
import { isOlderThan } from './timestamp.std.ts';
import { DAY } from './durations/index.std.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { MessageModel } from '../models/messages.preload.ts';

const log = createLogger('hydrateStoryContext');

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
    log.warn(`Message ${messageId} not found`);
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
        authorAci: context?.authorAci,
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
