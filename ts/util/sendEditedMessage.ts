// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DraftBodyRanges } from '../types/BodyRange';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import * as log from '../logging/log';
import type { AttachmentType } from '../types/Attachment';
import { ErrorWithToast } from '../types/ErrorWithToast';
import { SendStatus } from '../messages/MessageSendState';
import { ToastType } from '../types/Toast';
import { UUID } from '../types/UUID';
import { canEditMessage } from '../state/selectors/message';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { concat, filter, map, repeat, zipObject, find } from './iterables';
import { getConversationIdForLogging } from './idForLogging';
import { isQuoteAMatch } from '../messages/helpers';
import { getMessageById } from '../messages/getMessageById';
import { handleEditMessage } from './handleEditMessage';
import { incrementMessageCounter } from './incrementMessageCounter';
import { isGroupV1 } from './whatTypeOfConversation';
import { isNotNil } from './isNotNil';
import { isSignalConversation } from './isSignalConversation';
import { strictAssert } from './assert';
import { timeAndLogIfTooLong } from './timeAndLogIfTooLong';
import { makeQuote } from './makeQuote';

const SEND_REPORT_THRESHOLD_MS = 25;

export async function sendEditedMessage(
  conversationId: string,
  {
    body,
    bodyRanges,
    preview,
    quoteSentAt,
    quoteAuthorUuid,
    targetMessageId,
  }: {
    body?: string;
    bodyRanges?: DraftBodyRanges;
    preview: Array<LinkPreviewType>;
    quoteSentAt?: number;
    quoteAuthorUuid?: string;
    targetMessageId: string;
  }
): Promise<void> {
  const { messaging } = window.textsecure;
  strictAssert(messaging, 'messaging not available');

  const conversation = window.ConversationController.get(conversationId);
  strictAssert(conversation, 'no conversation found');

  const idLog = `sendEditedMessage(${getConversationIdForLogging(
    conversation.attributes
  )})`;

  const targetMessage = await getMessageById(targetMessageId);
  strictAssert(targetMessage, 'could not find message to edit');

  if (isGroupV1(conversation.attributes)) {
    log.warn(`${idLog}: can't send to gv1`);
    return;
  }

  if (isSignalConversation(conversation.attributes)) {
    log.warn(`${idLog}: can't send to Signal`);
    return;
  }

  if (!canEditMessage(targetMessage.attributes)) {
    throw new ErrorWithToast(
      `${idLog}: cannot edit`,
      ToastType.CannotEditMessage
    );
  }

  const timestamp = Date.now();

  log.info(`${idLog}: sending ${timestamp}`);

  conversation.clearTypingTimers();

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();
  const fromId = ourConversation.id;

  const recipientMaybeConversations = map(
    conversation.getRecipients({
      isStoryReply: false,
    }),
    identifier => window.ConversationController.get(identifier)
  );
  const recipientConversations = filter(recipientMaybeConversations, isNotNil);
  const recipientConversationIds = concat(
    map(recipientConversations, c => c.id),
    [fromId]
  );
  const sendStateByConversationId = zipObject(
    recipientConversationIds,
    repeat({
      status: SendStatus.Pending,
      updatedAt: timestamp,
    })
  );

  // Resetting send state for the target message
  targetMessage.set({ sendStateByConversationId });

  // Can't send both preview and attachments
  const attachments =
    preview && preview.length ? [] : targetMessage.get('attachments') || [];

  const fixNewAttachment = (
    attachment: AttachmentType,
    temporaryDigest: string
  ): AttachmentType => {
    // Check if this is an existing attachment or a new attachment coming
    // from composer
    if (attachment.digest) {
      return attachment;
    }

    // Generated semi-unique digest so that `handleEditMessage` understand
    // it is a new attachment
    return {
      ...attachment,
      digest: `${temporaryDigest}:${attachment.path}`,
    };
  };

  let quote: QuotedMessageType | undefined;
  if (quoteSentAt !== undefined && quoteAuthorUuid !== undefined) {
    const existingQuote = targetMessage.get('quote');

    // Keep the quote if unchanged.
    if (quoteSentAt === existingQuote?.id) {
      quote = existingQuote;
    } else {
      const messages = await window.Signal.Data.getMessagesBySentAt(
        quoteSentAt
      );
      const matchingMessage = find(messages, item =>
        isQuoteAMatch(item, conversationId, {
          id: quoteSentAt,
          authorUuid: quoteAuthorUuid,
        })
      );

      if (matchingMessage) {
        quote = await makeQuote(matchingMessage);
      }
    }
  }

  // An ephemeral message that we just use to handle the edit
  const tmpMessage: MessageAttributesType = {
    attachments: attachments?.map((attachment, index) =>
      fixNewAttachment(attachment, `attachment:${index}`)
    ),
    body,
    bodyRanges,
    conversationId,
    preview: preview?.map((entry, index) => {
      const image =
        entry.image && fixNewAttachment(entry.image, `preview:${index}`);
      if (entry.image === image) {
        return entry;
      }
      return {
        ...entry,
        image,
      };
    }),
    id: UUID.generate().toString(),
    quote,
    received_at: incrementMessageCounter(),
    received_at_ms: timestamp,
    sent_at: timestamp,
    timestamp,
    type: 'outgoing',
  };

  // Building up the dependencies for handling the edit message
  const editAttributes = {
    conversationId,
    fromId,
    message: tmpMessage,
    targetSentTimestamp: targetMessage.attributes.timestamp,
  };

  // Takes care of putting the message in the edit history, replacing the
  // main message's values, and updating the conversation's properties.
  await handleEditMessage(targetMessage.attributes, editAttributes);

  // Inserting the send into a job and saving it to the message
  await timeAndLogIfTooLong(
    SEND_REPORT_THRESHOLD_MS,
    () =>
      conversationJobQueue.add(
        {
          type: conversationQueueJobEnum.enum.NormalMessage,
          conversationId,
          messageId: targetMessageId,
          revision: conversation.get('revision'),
        },
        async jobToInsert => {
          log.info(
            `${idLog}: saving message ${targetMessageId} and job ${jobToInsert.id}`
          );
          await window.Signal.Data.saveMessage(targetMessage.attributes, {
            jobToInsert,
            ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
          });
        }
      ),
    duration => `${idLog}: db save took ${duration}ms`
  );

  // Does the same render dance that models/conversations does when we call
  // enqueueMessageForSend. Calls redux actions, clears drafts, unarchives, and
  // updates storage service if needed.
  await timeAndLogIfTooLong(
    SEND_REPORT_THRESHOLD_MS,
    async () => {
      conversation.beforeMessageSend({
        message: targetMessage,
        dontClearDraft: false,
        dontAddMessage: true,
        now: timestamp,
      });
    },
    duration => `${idLog}: batchDisptach took ${duration}ms`
  );

  window.Signal.Data.updateConversation(conversation.attributes);
}
