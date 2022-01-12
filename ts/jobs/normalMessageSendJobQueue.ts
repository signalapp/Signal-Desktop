// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type PQueue from 'p-queue';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { InMemoryQueues } from './helpers/InMemoryQueues';
import type { MessageModel } from '../models/messages';
import { getMessageById } from '../messages/getMessageById';
import type { ConversationModel } from '../models/conversations';
import { ourProfileKeyService } from '../services/ourProfileKey';
import { strictAssert } from '../util/assert';
import { isRecord } from '../util/isRecord';
import * as durations from '../util/durations';
import { isMe } from '../util/whatTypeOfConversation';
import { getSendOptions } from '../util/getSendOptions';
import { SignalService as Proto } from '../protobuf';
import { handleMessageSend } from '../util/handleMessageSend';
import type { CallbackResultType } from '../textsecure/Types.d';
import { isSent } from '../messages/MessageSendState';
import { getLastChallengeError, isOutgoing } from '../state/selectors/message';
import type { AttachmentType } from '../textsecure/SendMessage';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { BodyRangesType } from '../types/Util';
import type { WhatIsThis } from '../window.d';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { handleMultipleSendErrors } from './helpers/handleMultipleSendErrors';

const { loadAttachmentData, loadPreviewData, loadQuoteData, loadStickerData } =
  window.Signal.Migrations;
const { Message } = window.Signal.Types;

const MAX_RETRY_TIME = durations.DAY;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);

type NormalMessageSendJobData = {
  messageId: string;
  conversationId: string;
};

export class NormalMessageSendJobQueue extends JobQueue<NormalMessageSendJobData> {
  private readonly inMemoryQueues = new InMemoryQueues();

  protected parseData(data: unknown): NormalMessageSendJobData {
    // Because we do this so often and Zod is a bit slower, we do "manual" parsing here.
    strictAssert(isRecord(data), 'Job data is not an object');
    const { messageId, conversationId } = data;
    strictAssert(
      typeof messageId === 'string',
      'Job data had a non-string message ID'
    );
    strictAssert(
      typeof conversationId === 'string',
      'Job data had a non-string conversation ID'
    );
    return { messageId, conversationId };
  }

  protected override getInMemoryQueue({
    data,
  }: Readonly<{ data: NormalMessageSendJobData }>): PQueue {
    return this.inMemoryQueues.get(data.conversationId);
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: NormalMessageSendJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    const { messageId } = data;

    const timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();
    const isFinalAttempt = attempt >= MAX_ATTEMPTS;

    // We don't immediately use this value because we may want to mark the message
    //   failed before doing so.
    const shouldContinue = await commonShouldJobContinue({
      attempt,
      log,
      timeRemaining,
    });

    await window.ConversationController.load();

    const message = await getMessageById(messageId);
    if (!message) {
      log.info(
        `message ${messageId} was not found, maybe because it was deleted. Giving up on sending it`
      );
      return;
    }

    if (!isOutgoing(message.attributes)) {
      log.error(
        `message ${messageId} was not an outgoing message to begin with. This is probably a bogus job. Giving up on sending it`
      );
      return;
    }

    if (message.isErased() || message.get('deletedForEveryone')) {
      log.info(`message ${messageId} was erased. Giving up on sending it`);
      return;
    }

    let messageSendErrors: Array<Error> = [];

    // We don't want to save errors on messages unless we're giving up. If it's our
    //   final attempt, we know upfront that we want to give up. However, we might also
    //   want to give up if (1) we get a 508 from the server, asking us to please stop
    //   (2) we get a 428 from the server, flagging the message for spam (3) some other
    //   reason not known at the time of this writing.
    //
    // This awkward callback lets us hold onto errors we might want to save, so we can
    //   decide whether to save them later on.
    const saveErrors = isFinalAttempt
      ? undefined
      : (errors: Array<Error>) => {
          messageSendErrors = errors;
        };

    if (!shouldContinue) {
      log.info(`message ${messageId} ran out of time. Giving up on sending it`);
      await markMessageFailed(message, messageSendErrors);
      return;
    }

    try {
      const conversation = message.getConversation();
      if (!conversation) {
        throw new Error(
          `could not find conversation for message with ID ${messageId}`
        );
      }

      const {
        allRecipientIdentifiers,
        recipientIdentifiersWithoutMe,
        untrustedConversationIds,
      } = getMessageRecipients({
        message,
        conversation,
      });

      if (untrustedConversationIds.length) {
        log.info(
          `message ${messageId} sending blocked because ${untrustedConversationIds.length} conversation(s) were untrusted. Giving up on the job, but it may be reborn later`
        );
        window.reduxActions.conversations.messageStoppedByMissingVerification(
          messageId,
          untrustedConversationIds
        );
        await markMessageFailed(message, messageSendErrors);
        return;
      }

      if (!allRecipientIdentifiers.length) {
        log.warn(
          `trying to send message ${messageId} but it looks like it was already sent to everyone. This is unexpected, but we're giving up`
        );
        return;
      }

      const {
        attachments,
        body,
        deletedForEveryoneTimestamp,
        expireTimer,
        mentions,
        messageTimestamp,
        preview,
        profileKey,
        quote,
        sticker,
      } = await getMessageSendData({ conversation, log, message });

      let messageSendPromise: Promise<unknown>;

      if (recipientIdentifiersWithoutMe.length === 0) {
        log.info('sending sync message only');
        const dataMessage = await window.textsecure.messaging.getDataMessage({
          attachments,
          body,
          groupV2: conversation.getGroupV2Info({
            members: recipientIdentifiersWithoutMe,
          }),
          deletedForEveryoneTimestamp,
          expireTimer,
          preview,
          profileKey,
          quote,
          recipients: allRecipientIdentifiers,
          sticker,
          timestamp: messageTimestamp,
        });
        messageSendPromise = message.sendSyncMessageOnly(
          dataMessage,
          saveErrors
        );
      } else {
        const conversationType = conversation.get('type');
        const sendOptions = await getSendOptions(conversation.attributes);
        const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

        let innerPromise: Promise<CallbackResultType>;
        if (conversationType === Message.GROUP) {
          log.info('sending group message');
          innerPromise = conversation.queueJob(
            'normalMessageSendJobQueue',
            () =>
              window.Signal.Util.sendToGroup({
                contentHint: ContentHint.RESENDABLE,
                groupSendOptions: {
                  attachments,
                  deletedForEveryoneTimestamp,
                  expireTimer,
                  groupV1: conversation.getGroupV1Info(
                    recipientIdentifiersWithoutMe
                  ),
                  groupV2: conversation.getGroupV2Info({
                    members: recipientIdentifiersWithoutMe,
                  }),
                  messageText: body,
                  preview,
                  profileKey,
                  quote,
                  sticker,
                  timestamp: messageTimestamp,
                  mentions,
                },
                messageId,
                sendOptions,
                sendTarget: conversation.toSenderKeyTarget(),
                sendType: 'message',
              })
          );
        } else {
          log.info('sending direct message');
          innerPromise = window.textsecure.messaging.sendMessageToIdentifier({
            identifier: recipientIdentifiersWithoutMe[0],
            messageText: body,
            attachments,
            quote,
            preview,
            sticker,
            reaction: undefined,
            deletedForEveryoneTimestamp,
            timestamp: messageTimestamp,
            expireTimer,
            contentHint: ContentHint.RESENDABLE,
            groupId: undefined,
            profileKey,
            options: sendOptions,
          });
        }

        messageSendPromise = message.send(
          handleMessageSend(innerPromise, {
            messageIds: [messageId],
            sendType: 'message',
          }),
          saveErrors
        );
      }

      await messageSendPromise;

      if (
        getLastChallengeError({
          errors: messageSendErrors,
        })
      ) {
        log.info(
          `message ${messageId} hit a spam challenge. Not retrying any more`
        );
        await message.saveErrors(messageSendErrors);
        return;
      }

      const didFullySend =
        !messageSendErrors.length || didSendToEveryone(message);
      if (!didFullySend) {
        throw new Error('message did not fully send');
      }
    } catch (thrownError: unknown) {
      await handleMultipleSendErrors({
        errors: [thrownError, ...messageSendErrors],
        isFinalAttempt,
        log,
        markFailed: () => markMessageFailed(message, messageSendErrors),
        timeRemaining,
      });
    }
  }
}

export const normalMessageSendJobQueue = new NormalMessageSendJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'normal message send',
  maxAttempts: MAX_ATTEMPTS,
});

function getMessageRecipients({
  conversation,
  message,
}: Readonly<{
  conversation: ConversationModel;
  message: MessageModel;
}>): {
  allRecipientIdentifiers: Array<string>;
  recipientIdentifiersWithoutMe: Array<string>;
  untrustedConversationIds: Array<string>;
} {
  const allRecipientIdentifiers: Array<string> = [];
  const recipientIdentifiersWithoutMe: Array<string> = [];
  const untrustedConversationIds: Array<string> = [];

  const currentConversationRecipients =
    conversation.getRecipientConversationIds();

  Object.entries(message.get('sendStateByConversationId') || {}).forEach(
    ([recipientConversationId, sendState]) => {
      if (isSent(sendState.status)) {
        return;
      }

      const recipient = window.ConversationController.get(
        recipientConversationId
      );
      if (!recipient) {
        return;
      }

      const isRecipientMe = isMe(recipient.attributes);

      if (
        !currentConversationRecipients.has(recipientConversationId) &&
        !isRecipientMe
      ) {
        return;
      }

      if (recipient.isUntrusted()) {
        untrustedConversationIds.push(recipientConversationId);
      }

      const recipientIdentifier = recipient.getSendTarget();
      if (!recipientIdentifier) {
        return;
      }

      allRecipientIdentifiers.push(recipientIdentifier);
      if (!isRecipientMe) {
        recipientIdentifiersWithoutMe.push(recipientIdentifier);
      }
    }
  );

  return {
    allRecipientIdentifiers,
    recipientIdentifiersWithoutMe,
    untrustedConversationIds,
  };
}

async function getMessageSendData({
  conversation,
  log,
  message,
}: Readonly<{
  conversation: ConversationModel;
  log: LoggerType;
  message: MessageModel;
}>): Promise<{
  attachments: Array<AttachmentType>;
  body: undefined | string;
  deletedForEveryoneTimestamp: undefined | number;
  expireTimer: undefined | number;
  mentions: undefined | BodyRangesType;
  messageTimestamp: number;
  preview: Array<LinkPreviewType>;
  profileKey: undefined | Uint8Array;
  quote: WhatIsThis;
  sticker: WhatIsThis;
}> {
  let messageTimestamp: number;
  const sentAt = message.get('sent_at');
  const timestamp = message.get('timestamp');
  if (sentAt) {
    messageTimestamp = sentAt;
  } else if (timestamp) {
    log.error('message lacked sent_at. Falling back to timestamp');
    messageTimestamp = timestamp;
  } else {
    log.error(
      'message lacked sent_at and timestamp. Falling back to current time'
    );
    messageTimestamp = Date.now();
  }

  const [attachmentsWithData, preview, quote, sticker, profileKey] =
    await Promise.all([
      // We don't update the caches here because (1) we expect the caches to be populated
      //   on initial send, so they should be there in the 99% case (2) if you're retrying
      //   a failed message across restarts, we don't touch the cache for simplicity. If
      //   sends are failing, let's not add the complication of a cache.
      Promise.all((message.get('attachments') ?? []).map(loadAttachmentData)),
      message.cachedOutgoingPreviewData ||
        loadPreviewData(message.get('preview')),
      message.cachedOutgoingQuoteData || loadQuoteData(message.get('quote')),
      message.cachedOutgoingStickerData ||
        loadStickerData(message.get('sticker')),
      conversation.get('profileSharing')
        ? ourProfileKeyService.get()
        : undefined,
    ]);

  const { body, attachments } = window.Whisper.Message.getLongMessageAttachment(
    {
      body: message.get('body'),
      attachments: attachmentsWithData,
      now: messageTimestamp,
    }
  );

  return {
    attachments,
    body,
    deletedForEveryoneTimestamp: message.get('deletedForEveryoneTimestamp'),
    expireTimer: message.get('expireTimer'),
    mentions: message.get('bodyRanges'),
    messageTimestamp,
    preview,
    profileKey,
    quote,
    sticker,
  };
}

async function markMessageFailed(
  message: MessageModel,
  errors: Array<Error>
): Promise<void> {
  message.markFailed();
  message.saveErrors(errors, { skipSave: true });
  await window.Signal.Data.saveMessage(message.attributes, {
    ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
  });
}

function didSendToEveryone(message: Readonly<MessageModel>): boolean {
  const sendStateByConversationId =
    message.get('sendStateByConversationId') || {};
  return Object.values(sendStateByConversationId).every(sendState =>
    isSent(sendState.status)
  );
}
