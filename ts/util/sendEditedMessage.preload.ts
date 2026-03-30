// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import type { DraftBodyRanges } from '../types/BodyRange.std.ts';
import type { LinkPreviewType } from '../types/message/LinkPreviews.std.ts';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d.ts';
import { createLogger } from '../logging/log.std.ts';
import { DataReader, DataWriter } from '../sql/Client.preload.ts';
import { ErrorWithToast } from '../types/ErrorWithToast.std.ts';
import { SendStatus } from '../messages/MessageSendState.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import type { AciString } from '../types/ServiceId.std.ts';
import { canEditMessage, isWithinMaxEdits } from './canEditMessage.dom.ts';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.ts';
import {
  concat,
  filter,
  map,
  repeat,
  zipObject,
  find,
} from './iterables.std.ts';
import { getConversationIdForLogging } from './idForLogging.preload.ts';
import { isQuoteAMatch } from '../messages/quotes.preload.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { handleEditMessage } from './handleEditMessage.preload.ts';
import { incrementMessageCounter } from './incrementMessageCounter.preload.ts';
import { isGroupV1 } from './whatTypeOfConversation.dom.ts';
import { isNotNil } from './isNotNil.std.ts';
import { isSignalConversation } from './isSignalConversation.dom.ts';
import { strictAssert } from './assert.std.ts';
import { timeAndLogIfTooLong } from './timeAndLogIfTooLong.std.ts';
import { makeQuote } from './makeQuote.preload.ts';
import { getMessageSentTimestamp } from './getMessageSentTimestamp.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

const log = createLogger('sendEditedMessage');

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

  const originalAttachments = targetMessage.get('attachments');
  let previewToSend: Array<LinkPreviewType> | undefined = preview;
  if (originalAttachments?.length && preview.length) {
    log.error('Cannot send message with both attachments and preview');
    previewToSend = undefined;
  }

  // An ephemeral message that we just use to handle the edit
  const tmpMessage: MessageAttributesType = {
    attachments: originalAttachments,
    body,
    bodyRanges,
    conversationId,
    preview: previewToSend,
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
    fromDevice: itemStorage.user.getDeviceId() ?? 1,
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
