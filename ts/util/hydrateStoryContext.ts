// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import omit from 'lodash/omit';
import type { AttachmentType } from '../types/Attachment';
import type { MessageAttributesType } from '../model-types.d';
import { getAttachmentsForMessage } from '../state/selectors/message';
import { isAciString } from './isAciString';
import { isDirectConversation } from './whatTypeOfConversation';
import { softAssert, strictAssert } from './assert';

export async function hydrateStoryContext(
  messageId: string,
  storyMessageParam?: MessageAttributesType,
  {
    shouldSave,
  }: {
    shouldSave?: boolean;
  } = {}
): Promise<void> {
  let messageAttributes: MessageAttributesType;
  try {
    messageAttributes = await window.MessageCache.resolveAttributes(
      'hydrateStoryContext',
      messageId
    );
  } catch {
    return;
  }

  const { storyId } = messageAttributes;
  if (!storyId) {
    return;
  }

  const { storyReplyContext: context } = messageAttributes;
  // We'll continue trying to get the attachment as long as the message still exists
  if (context && (context.attachment?.url || !context.messageId)) {
    return;
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

  if (!storyMessage) {
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

    return;
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
}
