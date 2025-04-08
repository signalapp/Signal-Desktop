// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import type { DraftBodyRanges } from '../types/BodyRange';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import * as log from '../logging/log';
import { DataReader, DataWriter } from '../sql/Client';
import type { AttachmentType } from '../types/Attachment';
import { ErrorWithToast } from '../types/ErrorWithToast';
import { SendStatus } from '../messages/MessageSendState';
import { ToastType } from '../types/Toast';
import type { AciString } from '../types/ServiceId';
import { canEditMessage, isWithinMaxEdits } from './canEditMessage';
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
import { getMessageSentTimestamp } from './getMessageSentTimestamp';

const SEND_REPORT_THRESHOLD_MS = 25;

export async function sendEditedMessage(
  conversationId: string,
  {
    body,
    bodyRanges,
    preview,
    quoteSentAt,
    quoteAuthorAci,
    targetMessageId,
  }: {
    body?: string;
    bodyRanges?: DraftBodyRanges;
    preview: Array<LinkPreviewType>;
    quoteSentAt?: number;
    quoteAuthorAci?: AciString;
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

  if (
    !canEditMessage(targetMessage.attributes) ||
    !isWithinMaxEdits(targetMessage.attributes)
  ) {
    throw new ErrorWithToast(
      `${idLog}: cannot edit`,
      ToastType.CannotEditMessage
    );
  }

  const timestamp = Date.now();
  const targetSentTimestamp = getMessageSentTimestamp(
    targetMessage.attributes,
    {
      log,
    }
  );

  log.info(`${idLog}: edited(${timestamp}) original(${targetSentTimestamp})`);

  conversation.clearTypingTimers();

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
  if (quoteSentAt !== undefined && quoteAuthorAci !== undefined) {
    const existingQuote = targetMessage.get('quote');

    // Keep the quote if unchanged.
    if (quoteSentAt === existingQuote?.id) {
      quote = existingQuote;
    } else {
      const messages = await DataReader.getMessagesBySentAt(quoteSentAt);
      const matchingMessage = find(messages, item =>
        isQuoteAMatch(item, conversationId, {
          id: quoteSentAt,
          authorAci: quoteAuthorAci,
        })
      );

      if (matchingMessage) {
        quote = await makeQuote(matchingMessage);
      }
    }
  }

  const ourConversation =
    window.ConversationController.getOurConversationOrThrow();
  const fromId = ourConversation.id;

  // Create the send state for later use
  const recipientMaybeConversations = map(
    conversation.getRecipients(),
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
    id: generateUuid(),
    quote,
    received_at: incrementMessageCounter(),
    received_at_ms: timestamp,
    sendStateByConversationId,
    sent_at: timestamp,
    timestamp,
    type: 'outgoing',
  };

  // Takes care of putting the message in the edit history, replacing the
  // main message's values, and updating the conversation's properties.
  await handleEditMessage(targetMessage.attributes, {
    conversationId,
    fromId,
    fromDevice: window.storage.user.getDeviceId() ?? 1,
    message: tmpMessage,
  });

  // Reset send state prior to send
  targetMessage.set({ sendStateByConversationId });

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
          editedMessageTimestamp: timestamp,
        },
        async jobToInsert => {
          log.info(
            `${idLog}: saving message ${targetMessageId} and job ${jobToInsert.id}`
          );
          await window.MessageCache.saveMessage(targetMessage.attributes, {
            jobToInsert,
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
        message: targetMessage.attributes,
        dontClearDraft: false,
        dontAddMessage: true,
        now: timestamp,
      });
    },
    duration => `${idLog}: batchDispatch took ${duration}ms`
  );

  await DataWriter.updateConversation(conversation.attributes);
}
