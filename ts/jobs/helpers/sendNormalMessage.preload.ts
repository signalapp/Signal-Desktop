// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import PQueue from 'p-queue';
import { ContentHint } from '@signalapp/libsignal-client';
import Long from 'long';

import * as Errors from '../../types/errors.std.js';
import { strictAssert } from '../../util/assert.std.js';
import type { MessageModel } from '../../models/messages.preload.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import type { ConversationModel } from '../../models/conversations.preload.js';
import {
  isGroup,
  isGroupV2,
  isMe,
} from '../../util/whatTypeOfConversation.dom.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { findAndFormatContact } from '../../util/findAndFormatContact.preload.js';
import { uploadAttachment } from '../../util/uploadAttachment.preload.js';
import {
  loadAttachmentData,
  loadQuoteData,
  loadPreviewData,
  loadStickerData,
  loadContactData,
} from '../../util/migrations.preload.js';
import type { CallbackResultType } from '../../textsecure/Types.d.ts';
import { isSent } from '../../messages/MessageSendState.std.js';
import { isOutgoing, canReact } from '../../state/selectors/message.preload.js';
import type {
  ReactionType,
  OutgoingQuoteType,
  OutgoingQuoteAttachmentType,
  OutgoingLinkPreviewType,
  OutgoingStickerType,
} from '../../textsecure/SendMessage.preload.js';
import type {
  AttachmentDownloadableFromTransitTier,
  AttachmentType,
  UploadedAttachmentType,
} from '../../types/Attachment.std.js';
import { copyCdnFields } from '../../util/attachments.preload.js';
import type { RawBodyRange } from '../../types/BodyRange.std.js';
import type { EmbeddedContactWithUploadedAvatar } from '../../types/EmbeddedContact.std.js';
import type { StoryContextType } from '../../types/Util.std.js';
import type { PollCreateType } from '../../types/Polls.dom.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { GROUP } from '../../types/Message2.preload.js';
import type {
  ConversationQueueJobBundle,
  NormalMessageSendJobData,
} from '../conversationJobQueue.preload.js';
import type { QuotedMessageType } from '../../model-types.d.ts';

import { handleMultipleSendErrors } from './handleMultipleSendErrors.std.js';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.js';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';
import { isConversationAccepted } from '../../util/isConversationAccepted.preload.js';
import { sendToGroup } from '../../util/sendToGroup.preload.js';
import type { DurationInSeconds } from '../../util/durations/index.std.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';
import { normalizeAci } from '../../util/normalizeAci.std.js';
import {
  getPropForTimestamp,
  getTargetOfThisEditTimestamp,
  getChangesForPropAtTimestamp,
} from '../../util/editHelpers.std.js';
import { getMessageSentTimestamp } from '../../util/getMessageSentTimestamp.std.js';
import { isSignalConversation } from '../../util/isSignalConversation.dom.js';
import {
  isBodyTooLong,
  MAX_BODY_ATTACHMENT_BYTE_LENGTH,
  trimBody,
} from '../../util/longAttachment.std.js';
import {
  markFailed,
  saveErrorsOnMessage,
} from '../../test-node/util/messageFailures.preload.js';
import { getMessageIdForLogging } from '../../util/idForLogging.preload.js';
import { send, sendSyncMessageOnly } from '../../messages/send.preload.js';
import type { SignalService } from '../../protobuf/index.std.js';
import { uuidToBytes } from '../../util/uuidToBytes.std.js';
import { fromBase64 } from '../../Bytes.std.js';
import { MIMETypeToString } from '../../types/MIME.std.js';
import { canReuseExistingTransitCdnPointerForEditedMessage } from '../../util/Attachment.std.js';

const { isNumber } = lodash;

const MAX_CONCURRENT_ATTACHMENT_UPLOADS = 5;

export async function sendNormalMessage(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: NormalMessageSendJobData
): Promise<void> {
  const { messageId, revision, editedMessageTimestamp } = data;
  const message = await getMessageById(messageId);
  if (!message) {
    log.info(
      `message ${messageId} was not found, maybe because it was deleted. Giving up on sending it`
    );
    return;
  }

  const messageConversation = window.ConversationController.get(
    message.get('conversationId')
  );
  if (messageConversation !== conversation) {
    log.error(
      `Message conversation '${messageConversation?.idForLogging()}' does not match job conversation ${conversation.idForLogging()}`
    );
    return;
  }

  if (isSignalConversation(messageConversation)) {
    log.error(
      `Message conversation '${messageConversation?.idForLogging()}' is the Signal serviceId, not sending`
    );
    return;
  }

  if (!isOutgoing(message.attributes)) {
    log.error(
      `message ${messageId} was not an outgoing message to begin with. This is probably a bogus job. Giving up on sending it`
    );
    return;
  }

  if (message.get('isErased') || message.get('deletedForEveryone')) {
    log.info(`message ${messageId} was erased. Giving up on sending it`);
    return;
  }

  // The original timestamp for this message
  const messageTimestamp = getMessageSentTimestamp(message.attributes, {
    includeEdits: false,
    log,
  });
  // The timestamp for the thing we're sending now, whether a first send or an edit
  const targetTimestamp = editedMessageTimestamp || messageTimestamp;
  // The timestamp identifying the target of this edit; could be the original timestamp
  //   or the most recent edit prior to this one
  const targetOfThisEditTimestamp = getTargetOfThisEditTimestamp({
    message: message.attributes,
    targetTimestamp,
  });

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
    await markMessageFailed({
      message,
      errors: [new Error('Message send ran out of time')],
      targetTimestamp,
    });
    return;
  }

  let profileKey: Uint8Array | undefined;
  if (conversation.get('profileSharing')) {
    profileKey = await ourProfileKeyService.get();
  }

  let originalError: Error | undefined;

  try {
    const {
      allRecipientServiceIds,
      recipientServiceIdsWithoutMe,
      sentRecipientServiceIds,
      untrustedServiceIds,
    } = getMessageRecipients({
      log,
      message,
      conversation,
      targetTimestamp,
    });

    if (untrustedServiceIds.length) {
      window.reduxActions.conversations.conversationStoppedByMissingVerification(
        {
          conversationId: conversation.id,
          untrustedServiceIds,
        }
      );
      throw new Error(
        `Message ${messageId} sending blocked because ${untrustedServiceIds.length} conversation(s) were untrusted. Failing this attempt.`
      );
    }

    if (!allRecipientServiceIds.length) {
      log.warn(
        `trying to send message ${messageId} but it looks like it was already sent to everyone. This is unexpected, but we're giving up`
      );
      return;
    }

    const {
      attachments,
      body,
      contact,
      deletedForEveryoneTimestamp,
      expireTimer,
      bodyRanges,
      preview,
      quote,
      reaction,
      sticker,
      storyMessage,
      storyContext,
      poll,
    } = await getMessageSendData({
      log,
      message,
      targetTimestamp,
      isEditedMessageSend: editedMessageTimestamp != null,
    });

    if (reaction) {
      strictAssert(
        storyMessage,
        'Only story reactions can be sent as normal messages'
      );

      const ourConversationId =
        window.ConversationController.getOurConversationIdOrThrow();

      if (
        !canReact(
          storyMessage.attributes,
          ourConversationId,
          findAndFormatContact
        )
      ) {
        log.info(
          `could not react to ${messageId}. Removing this pending reaction`
        );
        await markMessageFailed({
          message,
          errors: [new Error('Could not react to story')],
          targetTimestamp,
        });
        return;
      }
    }

    log.info(
      'Sending normal message;',
      `editedMessageTimestamp=${editedMessageTimestamp},`,
      `storyMessage=${Boolean(storyMessage)}`
    );

    let messageSendPromise: Promise<CallbackResultType | void>;

    if (recipientServiceIdsWithoutMe.length === 0) {
      if (
        !isMe(conversation.attributes) &&
        !isGroup(conversation.attributes) &&
        sentRecipientServiceIds.length === 0
      ) {
        log.info(
          'No recipients; not sending to ourselves or to group, and no successful sends. Failing job.'
        );
        void markMessageFailed({
          message,
          errors: [new Error('No valid recipients')],
          targetTimestamp,
        });
        return;
      }

      // We're sending to Note to Self or a 'lonely group' with just us in it
      // or sending a story to a group where all other users don't have the stories
      // capabilities (effectively a 'lonely group' in the context of stories)
      log.info('sending sync message only');
      const dataMessage = await messaging.getDataOrEditMessage({
        attachments,
        body,
        bodyRanges,
        contact,
        deletedForEveryoneTimestamp,
        expireTimer,
        expireTimerVersion: conversation.getExpireTimerVersion(),
        groupV2: conversation.getGroupV2Info({
          members: recipientServiceIdsWithoutMe,
        }),
        preview,
        profileKey,
        quote,
        recipients: allRecipientServiceIds,
        sticker,
        storyContext,
        targetTimestampForEdit: editedMessageTimestamp
          ? targetOfThisEditTimestamp
          : undefined,
        timestamp: targetTimestamp,
        reaction,
        pollCreate: poll,
      });
      messageSendPromise = sendSyncMessageOnly(message, {
        dataMessage,
        saveErrors,
        targetTimestamp,
      });
    } else {
      const conversationType = conversation.get('type');
      const sendOptions = await getSendOptions(conversation.attributes);

      let innerPromise: Promise<CallbackResultType>;
      if (conversationType === GROUP) {
        // Note: this will happen for all old jobs queued beore 5.32.x
        if (isGroupV2(conversation.attributes) && !isNumber(revision)) {
          log.error('No revision provided, but conversation is GroupV2');
        }

        const groupV2Info = conversation.getGroupV2Info({
          members: recipientServiceIdsWithoutMe,
        });
        if (groupV2Info && isNumber(revision)) {
          groupV2Info.revision = revision;
        }

        log.info('sending group message');
        innerPromise = conversation.queueJob(
          'conversationQueue/sendNormalMessage',
          abortSignal =>
            sendToGroup({
              abortSignal,
              contentHint: ContentHint.Resendable,
              groupSendOptions: {
                attachments,
                bodyRanges,
                contact,
                deletedForEveryoneTimestamp,
                expireTimer,
                groupV2: groupV2Info,
                messageText: body,
                preview,
                profileKey,
                quote,
                sticker,
                storyContext,
                reaction,
                pollCreate: poll,
                targetTimestampForEdit: editedMessageTimestamp
                  ? targetOfThisEditTimestamp
                  : undefined,
                timestamp: targetTimestamp,
              },
              messageId,
              sendOptions,
              sendTarget: conversation.toSenderKeyTarget(),
              sendType: 'message',
              story: Boolean(storyContext),
              urgent: true,
            })
        );
      } else {
        if (!isConversationAccepted(conversation.attributes)) {
          log.info(
            `conversation ${conversation.idForLogging()} is not accepted; refusing to send`
          );
          void markMessageFailed({
            message,
            errors: [new Error('Message request was not accepted')],
            targetTimestamp,
          });
          return;
        }
        if (isConversationUnregistered(conversation.attributes)) {
          log.info(
            `conversation ${conversation.idForLogging()} is unregistered; refusing to send`
          );
          void markMessageFailed({
            message,
            errors: [new Error('Contact no longer has a Signal account')],
            targetTimestamp,
          });
          return;
        }
        if (conversation.isBlocked()) {
          log.info(
            `conversation ${conversation.idForLogging()} is blocked; refusing to send`
          );
          void markMessageFailed({
            message,
            errors: [new Error('Contact is blocked')],
            targetTimestamp,
          });
          return;
        }

        log.info('sending direct message');
        innerPromise = messaging.sendMessageToServiceId({
          attachments,
          bodyRanges,
          contact,
          contentHint: ContentHint.Resendable,
          deletedForEveryoneTimestamp,
          expireTimer,
          expireTimerVersion: conversation.getExpireTimerVersion(),
          groupId: undefined,
          serviceId: recipientServiceIdsWithoutMe[0],
          messageText: body,
          options: sendOptions,
          preview,
          profileKey,
          quote,
          sticker,
          storyContext,
          reaction,
          targetTimestampForEdit: editedMessageTimestamp
            ? targetOfThisEditTimestamp
            : undefined,
          timestamp: targetTimestamp,
          // Note: 1:1 story replies should not set story=true -   they aren't group sends
          urgent: true,
          includePniSignatureMessage: true,
        });
      }

      messageSendPromise = send(message, {
        promise: handleMessageSend(innerPromise, {
          messageIds: [messageId],
          sendType: 'message',
        }),
        saveErrors,
        targetTimestamp,
      });

      // Because message.send swallows and processes errors, we'll await the inner promise
      //   to get the SendMessageProtoError, which gives us information upstream
      //   processors need to detect certain kinds of situations.
      try {
        await innerPromise;
      } catch (error) {
        if (error instanceof Error) {
          originalError = error;
        } else {
          log.error(
            `promiseForError threw something other than an error: ${Errors.toLogFormat(
              error
            )}`
          );
        }
      }
    }

    await messageSendPromise;

    const didFullySend = didSendToEveryone({
      isSendingInGroup: conversation.get('type') === 'group',
      log,
      message,
      targetTimestamp: editedMessageTimestamp || messageTimestamp,
    });
    if (!didFullySend) {
      if (!messageSendErrors.length) {
        log.warn(
          'Did not send to everyone, but no errors returned - maybe all errors were UnregisteredUserErrors?'
        );
      }
      throw new Error('message did not fully send');
    }
  } catch (thrownError: unknown) {
    const errors = [thrownError, ...messageSendErrors];
    await handleMultipleSendErrors({
      errors,
      isFinalAttempt,
      log,
      markFailed: () =>
        markMessageFailed({
          message,
          errors: messageSendErrors,
          targetTimestamp,
        }),
      timeRemaining,
      // In the case of a failed group send thrownError will not be SentMessageProtoError,
      //   but we should have been able to harvest the original error. In the Note to Self
      //   send case, thrownError will be the error we care about, and we won't have an
      //   originalError.
      toThrow: originalError || thrownError,
    });
  }
}

function getMessageRecipients({
  log,
  conversation,
  message,
  targetTimestamp,
}: Readonly<{
  log: LoggerType;
  conversation: ConversationModel;
  message: MessageModel;
  targetTimestamp: number;
}>): {
  allRecipientServiceIds: Array<ServiceIdString>;
  recipientServiceIdsWithoutMe: Array<ServiceIdString>;
  sentRecipientServiceIds: Array<ServiceIdString>;
  untrustedServiceIds: Array<ServiceIdString>;
} {
  const allRecipientServiceIds: Array<ServiceIdString> = [];
  const recipientServiceIdsWithoutMe: Array<ServiceIdString> = [];
  const untrustedServiceIds: Array<ServiceIdString> = [];
  const sentRecipientServiceIds: Array<ServiceIdString> = [];

  const currentConversationRecipients = conversation.getMemberConversationIds();

  const sendStateByConversationId =
    getPropForTimestamp({
      log,
      message: message.attributes,
      prop: 'sendStateByConversationId',
      targetTimestamp,
    }) || {};

  Object.entries(sendStateByConversationId).forEach(
    ([recipientConversationId, sendState]) => {
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
        const serviceId = recipient.getServiceId();
        if (!serviceId) {
          log.error(
            `getMessageRecipients: Untrusted conversation ${recipient.idForLogging()} missing serviceId.`
          );
          return;
        }
        untrustedServiceIds.push(serviceId);
        return;
      }
      if (recipient.isUnregistered()) {
        return;
      }
      if (recipient.isBlocked()) {
        return;
      }

      const recipientIdentifier = recipient.getSendTarget();
      if (!recipientIdentifier) {
        return;
      }

      if (isSent(sendState.status)) {
        sentRecipientServiceIds.push(recipientIdentifier);
        return;
      }

      allRecipientServiceIds.push(recipientIdentifier);
      if (!isRecipientMe) {
        recipientServiceIdsWithoutMe.push(recipientIdentifier);
      }
    }
  );

  return {
    allRecipientServiceIds,
    recipientServiceIdsWithoutMe,
    sentRecipientServiceIds,
    untrustedServiceIds,
  };
}

async function getMessageSendData({
  log,
  message,
  targetTimestamp,
  isEditedMessageSend,
}: Readonly<{
  log: LoggerType;
  message: MessageModel;
  targetTimestamp: number;
  isEditedMessageSend: boolean;
}>): Promise<{
  attachments: Array<SignalService.IAttachmentPointer>;
  body: undefined | string;
  contact?: Array<EmbeddedContactWithUploadedAvatar>;
  deletedForEveryoneTimestamp: undefined | number;
  expireTimer: undefined | DurationInSeconds;
  bodyRanges: undefined | ReadonlyArray<RawBodyRange>;
  preview: Array<OutgoingLinkPreviewType> | undefined;
  quote: OutgoingQuoteType | undefined;
  sticker: OutgoingStickerType | undefined;
  reaction: ReactionType | undefined;
  storyMessage?: MessageModel;
  storyContext?: StoryContextType;
  poll?: PollCreateType;
}> {
  const storyId = message.get('storyId');

  // Figure out if we need to upload message body as an attachment.
  let body = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'body',
    targetTimestamp,
  });
  const maybeLongAttachment = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'bodyAttachment',
    targetTimestamp,
  });

  if (
    maybeLongAttachment &&
    maybeLongAttachment.size > MAX_BODY_ATTACHMENT_BYTE_LENGTH
  ) {
    throw new Error(
      `Body attachment too long for send: ${maybeLongAttachment.size}`
    );
  }

  if (body && isBodyTooLong(body)) {
    body = trimBody(body);
  }

  const uploadQueue = new PQueue({
    concurrency: MAX_CONCURRENT_ATTACHMENT_UPLOADS,
  });

  const preUploadAttachments =
    getPropForTimestamp({
      log,
      message: message.attributes,
      prop: 'attachments',
      targetTimestamp,
    }) || [];
  const [
    uploadedAttachments,
    maybeUploadedLongAttachment,
    contact,
    preview,
    quote,
    sticker,
    storyMessage,
  ] = await Promise.all([
    uploadQueue.addAll(
      preUploadAttachments.map(attachment => async () => {
        if (isEditedMessageSend) {
          if (canReuseExistingTransitCdnPointerForEditedMessage(attachment)) {
            return convertAttachmentToPointer(attachment);
          }
          log.error('Unable to reuse attachment pointer for edited message');
        }

        return uploadSingleAttachment({
          attachment,
          log,
          message,
          targetTimestamp,
        });
      })
    ),
    uploadQueue.add(async () =>
      maybeLongAttachment
        ? uploadLongMessageAttachment({
            attachment: maybeLongAttachment,
            log,
            message,
            targetTimestamp,
          })
        : undefined
    ),
    uploadMessageContacts(message, uploadQueue),
    uploadMessagePreviews({
      log,
      message,
      targetTimestamp,
      uploadQueue,
    }),
    uploadMessageQuote({
      log,
      message,
      targetTimestamp,
      uploadQueue,
    }),
    uploadMessageSticker(message, uploadQueue),
    storyId ? getMessageById(storyId) : undefined,
  ]);

  // Save message after uploading attachments
  await window.MessageCache.saveMessage(message.attributes);

  const storyReaction = message.get('storyReaction');
  const storySourceServiceId = storyMessage?.get('sourceServiceId');

  let reactionForSend: ReactionType | undefined;
  if (storyReaction) {
    const { targetAuthorAci, ...restOfReaction } = storyReaction;

    reactionForSend = {
      ...restOfReaction,
      targetAuthorAci,
      remove: false,
    };
  }

  return {
    attachments: [
      ...(maybeUploadedLongAttachment ? [maybeUploadedLongAttachment] : []),
      ...uploadedAttachments,
    ],
    body,
    contact,
    deletedForEveryoneTimestamp: message.get('deletedForEveryoneTimestamp'),
    expireTimer: message.get('expireTimer'),
    bodyRanges: getPropForTimestamp({
      log,
      message: message.attributes,
      prop: 'bodyRanges',
      targetTimestamp,
    }),
    preview,
    quote,
    reaction: reactionForSend,
    sticker,
    storyMessage,
    storyContext: storyMessage
      ? {
          authorAci: storySourceServiceId
            ? normalizeAci(
                storySourceServiceId,
                'sendNormalMessage.storyContext.authorAci'
              )
            : undefined,
          timestamp: storyMessage.get('sent_at'),
        }
      : undefined,
    poll: message.get('poll'),
  };
}

async function uploadSingleAttachment({
  attachment,
  log,
  message,
  targetTimestamp,
}: {
  attachment: AttachmentType;
  log: LoggerType;
  message: MessageModel;
  targetTimestamp: number;
}): Promise<UploadedAttachmentType> {
  const withData = await loadAttachmentData(attachment);
  const uploaded = await uploadAttachment(withData);

  // Add digest to the attachment
  const logId = `uploadSingleAttachment(${getMessageIdForLogging(message.attributes)}`;
  const oldAttachments = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'attachments',
    targetTimestamp,
  });
  strictAssert(
    oldAttachments !== undefined,
    `${logId}: Attachment was uploaded, but message doesn't ` +
      'have attachments anymore'
  );

  const index = oldAttachments.indexOf(attachment);
  strictAssert(
    index !== -1,
    `${logId}: Attachment was uploaded, but isn't in the message anymore`
  );

  const newAttachments = [...oldAttachments];
  newAttachments[index] = {
    ...newAttachments[index],
    ...copyCdnFields(uploaded),
  };

  const attributesToUpdate = getChangesForPropAtTimestamp({
    log,
    message: message.attributes,
    prop: 'attachments',
    targetTimestamp,
    value: newAttachments,
  });
  if (attributesToUpdate) {
    message.set(attributesToUpdate);
  }

  return uploaded;
}

async function uploadLongMessageAttachment({
  attachment,
  log,
  message,
  targetTimestamp,
}: {
  attachment: AttachmentType;
  log: LoggerType;
  message: MessageModel;
  targetTimestamp: number;
}): Promise<UploadedAttachmentType> {
  const withData = await loadAttachmentData(attachment);
  const uploaded = await uploadAttachment(withData);

  // Add digest to the attachment
  const logId = `uploadLongMessageAttachment(${getMessageIdForLogging(message.attributes)}`;
  const oldAttachment = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'bodyAttachment',
    targetTimestamp,
  });
  strictAssert(
    oldAttachment !== undefined,
    `${logId}: Attachment was uploaded, but message doesn't ` +
      'have long message attachment anymore'
  );

  const newBodyAttachment = { ...oldAttachment, ...copyCdnFields(uploaded) };

  const attributesToUpdate = getChangesForPropAtTimestamp({
    log,
    message: message.attributes,
    prop: 'bodyAttachment',
    targetTimestamp,
    value: newBodyAttachment,
  });
  if (attributesToUpdate) {
    message.set(attributesToUpdate);
  }

  return uploaded;
}

async function uploadMessageQuote({
  log,
  message,
  targetTimestamp,
  uploadQueue,
}: {
  log: LoggerType;
  message: MessageModel;
  targetTimestamp: number;
  uploadQueue: PQueue;
}): Promise<OutgoingQuoteType | undefined> {
  // We don't update the caches here because (1) we expect the caches to be populated
  //   on initial send, so they should be there in the 99% case (2) if you're retrying
  //   a failed message across restarts, we don't touch the cache for simplicity. If
  //   sends are failing, let's not add the complication of a cache.
  const startingQuote = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'quote',
    targetTimestamp,
  });
  let loadedQuote: QuotedMessageType | null;

  // We are resilient to this because it's easy for quote thumbnails to be deleted out
  // from under us, since the attachment is shared with the original message. Delete for
  // Everyone on the original message, and the shared attachment will be deleted.
  try {
    loadedQuote = await loadQuoteData(startingQuote);
    if (!loadedQuote) {
      return undefined;
    }
  } catch (error) {
    log.error(
      'uplodateMessageQuote: Failed to load quote thumbnail',
      Errors.toLogFormat(error)
    );
    if (!startingQuote) {
      return undefined;
    }

    return {
      isGiftBadge: startingQuote.isGiftBadge,
      id: startingQuote.id ?? undefined,
      authorAci: startingQuote.authorAci
        ? normalizeAci(
            startingQuote.authorAci,
            'sendNormalMessage.quote.authorAci'
          )
        : undefined,
      text: startingQuote.text,
      bodyRanges: startingQuote.bodyRanges,
      attachments: (startingQuote.attachments || []).map(attachment => {
        return {
          contentType: attachment.contentType,
          fileName: attachment.fileName,
        };
      }),
    };
  }

  const attachmentsAfterThumbnailUpload = await uploadQueue.addAll(
    loadedQuote.attachments.map(
      attachment => async (): Promise<OutgoingQuoteAttachmentType> => {
        const { thumbnail } = attachment;
        if (!thumbnail || !thumbnail.data) {
          return {
            contentType: attachment.contentType,
            fileName: attachment.fileName,
          };
        }

        const uploaded = await uploadAttachment({
          ...thumbnail,
          data: thumbnail.data,
        });

        return {
          contentType: attachment.contentType,
          fileName: attachment.fileName,
          thumbnail: uploaded,
        };
      }
    )
  );

  // Update message with attachment digests
  const logId = `uploadMessageQuote(${getMessageIdForLogging(message.attributes)}`;
  const oldQuote = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'quote',
    targetTimestamp,
  });
  strictAssert(oldQuote, `${logId}: Quote is gone after upload`);

  const newQuote = {
    ...oldQuote,
    attachments: oldQuote.attachments.map((attachment, index) => {
      if (!attachment.thumbnail) {
        return attachment;
      }

      strictAssert(
        attachment.thumbnail.path ===
          loadedQuote.attachments.at(index)?.thumbnail?.path,
        `${logId}: Quote attachment ${index} was updated from under us`
      );

      const attachmentAfterThumbnailUpload =
        attachmentsAfterThumbnailUpload[index];
      return {
        ...attachment,
        thumbnail: {
          ...attachment.thumbnail,
          ...copyCdnFields(attachmentAfterThumbnailUpload.thumbnail),
        },
      };
    }),
  };
  const attributesToUpdate = getChangesForPropAtTimestamp({
    log,
    message: message.attributes,
    prop: 'quote',
    targetTimestamp,
    value: newQuote,
  });
  if (attributesToUpdate) {
    message.set(attributesToUpdate);
  }

  return {
    isGiftBadge: loadedQuote.isGiftBadge,
    id: loadedQuote.id ?? undefined,
    authorAci: loadedQuote.authorAci
      ? normalizeAci(loadedQuote.authorAci, 'sendNormalMessage.quote.authorAci')
      : undefined,
    text: loadedQuote.text,
    bodyRanges: loadedQuote.bodyRanges,
    attachments: attachmentsAfterThumbnailUpload,
  };
}

async function uploadMessagePreviews({
  log,
  message,
  targetTimestamp,
  uploadQueue,
}: {
  log: LoggerType;
  message: MessageModel;
  targetTimestamp: number;
  uploadQueue: PQueue;
}): Promise<Array<OutgoingLinkPreviewType> | undefined> {
  // See uploadMessageQuote for comment on how we do caching for these
  // attachments.
  const startingPreview = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'preview',
    targetTimestamp,
  });

  const loadedPreviews = await loadPreviewData(startingPreview);

  if (!loadedPreviews) {
    return undefined;
  }
  if (loadedPreviews.length === 0) {
    return [];
  }

  const uploadedPreviews = await uploadQueue.addAll(
    loadedPreviews.map(
      preview => async (): Promise<OutgoingLinkPreviewType> => {
        if (!preview.image) {
          return {
            ...preview,

            // Pacify typescript
            image: undefined,
          };
        }

        return {
          ...preview,
          image: await uploadAttachment(preview.image),
        };
      }
    )
  );

  // Update message with attachment digests
  const logId = `uploadMessagePreviews(${getMessageIdForLogging(message.attributes)}`;
  const oldPreview = getPropForTimestamp({
    log,
    message: message.attributes,
    prop: 'preview',
    targetTimestamp,
  });
  strictAssert(oldPreview, `${logId}: Link preview is gone after upload`);

  const newPreview = oldPreview.map((preview, index) => {
    strictAssert(
      preview.image?.path === loadedPreviews.at(index)?.image?.path,
      `${logId}: Preview attachment ${index} was updated from under us`
    );

    const uploaded = uploadedPreviews.at(index);
    if (!preview.image || !uploaded?.image) {
      return preview;
    }

    return {
      ...preview,
      image: {
        ...preview.image,
        ...copyCdnFields(uploaded.image),
      },
    };
  });

  const attributesToUpdate = getChangesForPropAtTimestamp({
    log,
    message: message.attributes,
    prop: 'preview',
    targetTimestamp,
    value: newPreview,
  });
  if (attributesToUpdate) {
    message.set(attributesToUpdate);
  }

  return uploadedPreviews;
}

async function uploadMessageSticker(
  message: MessageModel,
  uploadQueue: PQueue
): Promise<OutgoingStickerType | undefined> {
  // See uploadMessageQuote for comment on how we do caching for these
  // attachments.
  const startingSticker = message.get('sticker');
  const stickerWithData = await loadStickerData(startingSticker);

  if (!stickerWithData) {
    return undefined;
  }

  const uploaded = await uploadQueue.add(() =>
    uploadAttachment(stickerWithData.data)
  );

  // Add digest to the attachment
  const logId = `uploadMessageSticker(${getMessageIdForLogging(message.attributes)}`;
  const existingSticker = message.get('sticker');
  strictAssert(
    existingSticker?.data !== undefined,
    `${logId}: Sticker was uploaded, but message doesn't ` +
      'have a sticker anymore'
  );
  strictAssert(
    existingSticker.data.path === startingSticker?.data?.path,
    `${logId}: Sticker was uploaded, but message has a different sticker`
  );
  message.set({
    sticker: {
      ...existingSticker,
      data: {
        ...existingSticker.data,
        ...copyCdnFields(uploaded),
      },
    },
  });

  return {
    ...stickerWithData,
    data: uploaded,
  };
}

async function uploadMessageContacts(
  message: MessageModel,
  uploadQueue: PQueue
): Promise<Array<EmbeddedContactWithUploadedAvatar> | undefined> {
  // See uploadMessageQuote for comment on how we do caching for these
  // attachments.
  const contacts = await loadContactData(message.get('contact'));

  if (!contacts) {
    return undefined;
  }
  if (contacts.length === 0) {
    return [];
  }

  const uploadedContacts = await uploadQueue.addAll(
    contacts.map(
      contact => async (): Promise<EmbeddedContactWithUploadedAvatar> => {
        const avatar = contact.avatar?.avatar;
        // Pacify typescript
        if (contact.avatar === undefined || !avatar) {
          return {
            ...contact,
            avatar: undefined,
          };
        }

        const uploaded = await uploadAttachment(avatar);

        return {
          ...contact,
          avatar: {
            ...contact.avatar,
            avatar: uploaded,
          },
        };
      }
    )
  );

  // Add digest to the attachment
  const logId = `uploadMessageContacts(${getMessageIdForLogging(message.attributes)}`;
  const oldContact = message.get('contact');
  strictAssert(oldContact, `${logId}: Contacts are gone after upload`);

  const newContact = oldContact.map((contact, index) => {
    const loaded = contacts.at(index);
    if (!contact.avatar) {
      strictAssert(
        loaded?.avatar === undefined,
        `${logId}: Avatar erased in the message`
      );
      return contact;
    }

    strictAssert(
      loaded !== undefined &&
        loaded.avatar !== undefined &&
        loaded.avatar.avatar.path === contact.avatar.avatar.path,
      `${logId}: Avatar has incorrect path`
    );
    const uploaded = uploadedContacts.at(index);
    strictAssert(
      uploaded !== undefined && uploaded.avatar !== undefined,
      `${logId}: Avatar wasn't uploaded properly`
    );

    return {
      ...contact,
      avatar: {
        ...contact.avatar,
        avatar: {
          ...contact.avatar.avatar,
          ...copyCdnFields(uploaded.avatar.avatar),
        },
      },
    };
  });
  message.set({ contact: newContact });

  return uploadedContacts;
}

async function markMessageFailed({
  errors,
  message,
  targetTimestamp,
}: {
  errors: Array<Error>;
  message: MessageModel;
  targetTimestamp: number;
}): Promise<void> {
  markFailed(message, targetTimestamp);
  await saveErrorsOnMessage(message, errors, {
    skipSave: false,
  });
}

function didSendToEveryone({
  isSendingInGroup,
  log,
  message,
  targetTimestamp,
}: {
  isSendingInGroup: boolean;
  log: LoggerType;
  message: MessageModel;
  targetTimestamp: number;
}): boolean {
  const sendStateByConversationId =
    getPropForTimestamp({
      log,
      message: message.attributes,
      prop: 'sendStateByConversationId',
      targetTimestamp,
    }) || {};
  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();
  const areWePrimaryDevice = window.ConversationController.areWePrimaryDevice();

  return Object.entries(sendStateByConversationId).every(
    ([conversationId, sendState]) => {
      const conversation = window.ConversationController.get(conversationId);
      if (isSendingInGroup) {
        if (!conversation) {
          return true;
        }
        if (conversation.isUnregistered()) {
          return true;
        }
      }

      if (conversationId === ourConversationId && areWePrimaryDevice) {
        return true;
      }

      return isSent(sendState.status);
    }
  );
}

function convertAttachmentToPointer(
  attachment: AttachmentDownloadableFromTransitTier
): SignalService.IAttachmentPointer {
  const {
    cdnKey,
    cdnNumber,
    clientUuid,
    key,
    size,
    digest,
    incrementalMac,
    chunkSize,
    uploadTimestamp,
    contentType,
    fileName,
    flags,
    width,
    height,
    caption,
    blurHash,
  } = attachment;

  return {
    cdnKey,
    cdnNumber,
    clientUuid: clientUuid ? uuidToBytes(clientUuid) : undefined,
    key: fromBase64(key),
    size,
    digest: fromBase64(digest),
    incrementalMac: incrementalMac ? fromBase64(incrementalMac) : undefined,
    chunkSize,
    uploadTimestamp: uploadTimestamp
      ? Long.fromNumber(uploadTimestamp)
      : undefined,
    contentType: MIMETypeToString(contentType),
    fileName,
    flags,
    width,
    height,
    caption,
    blurHash,
  };
}
