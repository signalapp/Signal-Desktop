// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import PQueue from 'p-queue';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { sleepFor413RetryAfterTimeIfApplicable } from './helpers/sleepFor413RetryAfterTimeIfApplicable';
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
import { HTTPError } from '../textsecure/Errors';
import { isSent } from '../messages/MessageSendState';
import { getLastChallengeError, isOutgoing } from '../state/selectors/message';
import { parseIntWithFallback } from '../util/parseIntWithFallback';
import * as Errors from '../types/errors';
import type {
  AttachmentType,
  GroupV1InfoType,
  GroupV2InfoType,
  PreviewType,
} from '../textsecure/SendMessage';
import type { BodyRangesType } from '../types/Util';
import type { WhatIsThis } from '../window.d';

import type { ParsedJob } from './types';
import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { Job } from './Job';

const {
  loadAttachmentData,
  loadPreviewData,
  loadQuoteData,
  loadStickerData,
} = window.Signal.Migrations;
const { Message } = window.Signal.Types;

const MAX_RETRY_TIME = durations.DAY;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);

type NormalMessageSendJobData = {
  messageId: string;
  conversationId: string;
};

export class NormalMessageSendJobQueue extends JobQueue<NormalMessageSendJobData> {
  private readonly queues = new Map<string, PQueue>();

  /**
   * Add a job (see `JobQueue.prototype.add`).
   *
   * You can override `insert` to change the way the job is added to the database. This is
   * useful if you're trying to save a message and a job in the same database transaction.
   */
  async add(
    data: Readonly<NormalMessageSendJobData>,
    insert?: (job: ParsedJob<NormalMessageSendJobData>) => Promise<void>
  ): Promise<Job<NormalMessageSendJobData>> {
    if (!insert) {
      return super.add(data);
    }

    this.throwIfNotStarted();

    const job = this.createJob(data);
    await insert(job);
    await jobQueueDatabaseStore.insert(job, {
      shouldInsertIntoDatabase: false,
    });
    return job;
  }

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

  protected getInMemoryQueue({
    data,
  }: Readonly<{ data: NormalMessageSendJobData }>): PQueue {
    const { conversationId } = data;

    const existingQueue = this.queues.get(conversationId);
    if (existingQueue) {
      return existingQueue;
    }

    const newQueue = new PQueue({ concurrency: 1 });
    newQueue.once('idle', () => {
      this.queues.delete(conversationId);
    });

    this.queues.set(conversationId, newQueue);
    return newQueue;
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

    await window.ConversationController.loadPromise();

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
      } = await getMessageSendData({ conversation, message });

      let messageSendPromise: Promise<unknown>;

      if (recipientIdentifiersWithoutMe.length === 0) {
        log.info('sending sync message only');
        const dataMessage = await window.textsecure.messaging.getDataMessage({
          attachments,
          body,
          groupV2: updateRecipients(
            conversation.getGroupV2Info(),
            recipientIdentifiersWithoutMe
          ),
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
                groupSendOptions: {
                  attachments,
                  deletedForEveryoneTimestamp,
                  expireTimer,
                  groupV1: updateRecipients(
                    conversation.getGroupV1Info(),
                    recipientIdentifiersWithoutMe
                  ),
                  groupV2: updateRecipients(
                    conversation.getGroupV2Info(),
                    recipientIdentifiersWithoutMe
                  ),
                  messageText: body,
                  preview,
                  profileKey,
                  quote,
                  sticker,
                  timestamp: messageTimestamp,
                  mentions,
                },
                conversation,
                contentHint: ContentHint.RESENDABLE,
                messageId,
                sendOptions,
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
            reaction: null,
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
    } catch (err: unknown) {
      const formattedMessageSendErrors: Array<string> = [];
      let serverAskedUsToStop = false;
      let maybe413Error: undefined | Error;
      messageSendErrors.forEach((messageSendError: unknown) => {
        formattedMessageSendErrors.push(Errors.toLogFormat(messageSendError));
        if (!(messageSendError instanceof HTTPError)) {
          return;
        }
        switch (parseIntWithFallback(messageSendError.code, -1)) {
          case 413:
            maybe413Error ||= messageSendError;
            break;
          case 508:
            serverAskedUsToStop = true;
            break;
          default:
            break;
        }
      });
      log.info(
        `${
          messageSendErrors.length
        } message send error(s): ${formattedMessageSendErrors.join(',')}`
      );

      if (isFinalAttempt || serverAskedUsToStop) {
        await markMessageFailed(message, messageSendErrors);
      }

      if (serverAskedUsToStop) {
        log.info('server responded with 508. Giving up on this job');
        return;
      }

      if (!isFinalAttempt) {
        await sleepFor413RetryAfterTimeIfApplicable({
          err: maybe413Error,
          log,
          timeRemaining,
        });
      }

      throw err;
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

  const currentConversationRecipients = conversation.getRecipientConversationIds();

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
  message,
}: Readonly<{
  conversation: ConversationModel;
  message: MessageModel;
}>): Promise<{
  attachments: Array<AttachmentType>;
  body: undefined | string;
  deletedForEveryoneTimestamp: undefined | number;
  expireTimer: undefined | number;
  mentions: undefined | BodyRangesType;
  messageTimestamp: number;
  preview: Array<PreviewType>;
  profileKey: undefined | ArrayBuffer;
  quote: WhatIsThis;
  sticker: WhatIsThis;
}> {
  const messageTimestamp =
    message.get('sent_at') || message.get('timestamp') || Date.now();

  const [
    attachmentsWithData,
    preview,
    quote,
    sticker,
    profileKey,
  ] = await Promise.all([
    // We don't update the caches here because (1) we expect the caches to be populated on
    //   initial send, so they should be there in the 99% case (2) if you're retrying a
    //   failed message across restarts, we don't touch the cache for simplicity. If sends
    //   are failing, let's not add the complication of a cache.
    Promise.all((message.get('attachments') ?? []).map(loadAttachmentData)),
    message.cachedOutgoingPreviewData ||
      loadPreviewData(message.get('preview')),
    message.cachedOutgoingQuoteData || loadQuoteData(message.get('quote')),
    message.cachedOutgoingStickerData ||
      loadStickerData(message.get('sticker')),
    conversation.get('profileSharing') ? ourProfileKeyService.get() : undefined,
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
  await window.Signal.Data.saveMessage(message.attributes);
}

function didSendToEveryone(message: Readonly<MessageModel>): boolean {
  const sendStateByConversationId =
    message.get('sendStateByConversationId') || {};
  return Object.values(sendStateByConversationId).every(sendState =>
    isSent(sendState.status)
  );
}

function updateRecipients(
  groupInfo: undefined | GroupV1InfoType,
  recipients: Array<string>
): undefined | GroupV1InfoType;
function updateRecipients(
  groupInfo: undefined | GroupV2InfoType,
  recipients: Array<string>
): undefined | GroupV2InfoType;
function updateRecipients(
  groupInfo: undefined | GroupV1InfoType | GroupV2InfoType,
  recipients: Array<string>
): undefined | GroupV1InfoType | GroupV2InfoType {
  return (
    groupInfo && {
      ...groupInfo,
      members: recipients,
    }
  );
}
