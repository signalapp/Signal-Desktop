// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import { v4 as generateUuid } from 'uuid';

import * as Errors from '../../types/errors';
import { strictAssert } from '../../util/assert';
import { repeat, zipObject } from '../../util/iterables';
import type { CallbackResultType } from '../../textsecure/Types.d';
import type { MessageModel } from '../../models/messages';
import type { MessageReactionType } from '../../model-types.d';
import type { ConversationModel } from '../../models/conversations';
import { DataWriter } from '../../sql/Client';

import * as reactionUtil from '../../reactions/util';
import { isSent, SendStatus } from '../../messages/MessageSendState';
import { __DEPRECATED$getMessageById } from '../../messages/getMessageById';
import { isIncoming } from '../../messages/helpers';
import {
  isMe,
  isDirectConversation,
  isGroupV2,
} from '../../util/whatTypeOfConversation';
import { getSendOptions } from '../../util/getSendOptions';
import { SignalService as Proto } from '../../protobuf';
import { handleMessageSend } from '../../util/handleMessageSend';
import { ourProfileKeyService } from '../../services/ourProfileKey';
import { canReact, isStory } from '../../state/selectors/message';
import { findAndFormatContact } from '../../util/findAndFormatContact';
import type { AciString, ServiceIdString } from '../../types/ServiceId';
import { isAciString } from '../../util/isAciString';
import { handleMultipleSendErrors } from './handleMultipleSendErrors';
import { incrementMessageCounter } from '../../util/incrementMessageCounter';

import type {
  ConversationQueueJobBundle,
  ReactionJobData,
} from '../conversationJobQueue';
import { isConversationAccepted } from '../../util/isConversationAccepted';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import type { LoggerType } from '../../types/Logging';
import { sendToGroup } from '../../util/sendToGroup';

export async function sendReaction(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: ReactionJobData
): Promise<void> {
  const { messageId, revision } = data;
  const ourAci = window.textsecure.storage.user.getCheckedAci();

  await window.ConversationController.load();

  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();

  const message = await __DEPRECATED$getMessageById(messageId);
  if (!message) {
    log.info(
      `message ${messageId} was not found, maybe because it was deleted. Giving up on sending its reactions`
    );
    return;
  }

  strictAssert(
    !isStory(message.attributes),
    'Story reactions should be handled by sendStoryReaction'
  );
  const { pendingReaction, emojiToRemove } =
    reactionUtil.getNewestPendingOutgoingReaction(
      getReactions(message),
      ourConversationId
    );

  if (!pendingReaction) {
    log.info(`no pending reaction for ${messageId}. Doing nothing`);
    return;
  }

  if (!canReact(message.attributes, ourConversationId, findAndFormatContact)) {
    log.info(`could not react to ${messageId}. Removing this pending reaction`);
    markReactionFailed(message, pendingReaction);
    await DataWriter.saveMessage(message.attributes, { ourAci });
    return;
  }

  if (!shouldContinue) {
    log.info(
      `reacting to message ${messageId} ran out of time. Giving up on sending it`
    );
    markReactionFailed(message, pendingReaction);
    await DataWriter.saveMessage(message.attributes, { ourAci });
    return;
  }

  let sendErrors: Array<Error> = [];
  const saveErrors = (errors: Array<Error>): void => {
    sendErrors = errors;
  };

  let originalError: Error | undefined;

  try {
    const messageConversation = message.getConversation();
    if (messageConversation !== conversation) {
      log.error(
        `message conversation '${messageConversation?.idForLogging()}' does not match job conversation ${conversation.idForLogging()}`
      );
      return;
    }

    const expireTimer = messageConversation.get('expireTimer');
    const {
      allRecipientServiceIds,
      recipientServiceIdsWithoutMe,
      untrustedServiceIds,
    } = getRecipients(log, pendingReaction, conversation);

    if (untrustedServiceIds.length) {
      window.reduxActions.conversations.conversationStoppedByMissingVerification(
        {
          conversationId: conversation.id,
          untrustedServiceIds,
        }
      );
      throw new Error(
        `Reaction for message ${messageId} sending blocked because ${untrustedServiceIds.length} conversation(s) were untrusted. Failing this attempt.`
      );
    }

    const profileKey = conversation.get('profileSharing')
      ? await ourProfileKeyService.get()
      : undefined;

    const { emoji, ...restOfPendingReaction } = pendingReaction;

    let targetAuthorAci: AciString;
    if (isIncoming(message.attributes)) {
      strictAssert(
        isAciString(message.attributes.sourceServiceId),
        'incoming message does not have sender ACI'
      );
      ({ sourceServiceId: targetAuthorAci } = message.attributes);
    } else {
      targetAuthorAci = ourAci;
    }

    const reactionForSend = {
      ...restOfPendingReaction,
      emoji: emoji || emojiToRemove,
      targetAuthorAci,
      remove: !emoji,
    };
    const ephemeralMessageForReactionSend = new window.Whisper.Message({
      id: generateUuid(),
      type: 'outgoing',
      conversationId: conversation.get('id'),
      sent_at: pendingReaction.timestamp,
      received_at: incrementMessageCounter(),
      received_at_ms: pendingReaction.timestamp,
      timestamp: pendingReaction.timestamp,
      sendStateByConversationId: zipObject(
        Object.keys(pendingReaction.isSentByConversationId || {}),
        repeat({
          status: SendStatus.Pending,
          updatedAt: Date.now(),
        })
      ),
    });
    // Adds the reaction's attributes to the message cache so that we can
    // safely `set` on it later.
    window.MessageCache.toMessageAttributes(
      ephemeralMessageForReactionSend.attributes
    );

    ephemeralMessageForReactionSend.doNotSave = true;

    let didFullySend: boolean;
    const successfulConversationIds = new Set<string>();

    if (recipientServiceIdsWithoutMe.length === 0) {
      log.info('sending sync reaction message only');
      const dataMessage = await messaging.getDataOrEditMessage({
        attachments: [],
        expireTimer,
        groupV2: conversation.getGroupV2Info({
          members: recipientServiceIdsWithoutMe,
        }),
        preview: [],
        profileKey,
        reaction: reactionForSend,
        recipients: allRecipientServiceIds,
        timestamp: pendingReaction.timestamp,
      });
      await ephemeralMessageForReactionSend.sendSyncMessageOnly({
        dataMessage,
        saveErrors,
        targetTimestamp: pendingReaction.timestamp,
      });

      didFullySend = true;
      successfulConversationIds.add(ourConversationId);
    } else {
      const sendOptions = await getSendOptions(conversation.attributes);
      const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

      let promise: Promise<CallbackResultType>;
      if (isDirectConversation(conversation.attributes)) {
        if (!isConversationAccepted(conversation.attributes)) {
          log.info(
            `conversation ${conversation.idForLogging()} is not accepted; refusing to send`
          );
          markReactionFailed(message, pendingReaction);
          return;
        }
        if (isConversationUnregistered(conversation.attributes)) {
          log.info(
            `conversation ${conversation.idForLogging()} is unregistered; refusing to send`
          );
          markReactionFailed(message, pendingReaction);
          return;
        }
        if (conversation.isBlocked()) {
          log.info(
            `conversation ${conversation.idForLogging()} is blocked; refusing to send`
          );
          markReactionFailed(message, pendingReaction);
          return;
        }

        log.info('sending direct reaction message');
        promise = messaging.sendMessageToServiceId({
          serviceId: recipientServiceIdsWithoutMe[0],
          messageText: undefined,
          attachments: [],
          quote: undefined,
          preview: [],
          sticker: undefined,
          reaction: reactionForSend,
          deletedForEveryoneTimestamp: undefined,
          timestamp: pendingReaction.timestamp,
          expireTimer,
          contentHint: ContentHint.RESENDABLE,
          groupId: undefined,
          profileKey,
          options: sendOptions,
          urgent: true,
          includePniSignatureMessage: true,
        });
      } else {
        log.info('sending group reaction message');
        promise = conversation.queueJob(
          'conversationQueue/sendReaction',
          abortSignal => {
            // Note: this will happen for all old jobs queued before 5.32.x
            if (isGroupV2(conversation.attributes) && !isNumber(revision)) {
              log.error('No revision provided, but conversation is GroupV2');
            }

            const groupV2Info = conversation.getGroupV2Info({
              members: recipientServiceIdsWithoutMe,
            });
            if (groupV2Info && isNumber(revision)) {
              groupV2Info.revision = revision;
            }

            return sendToGroup({
              abortSignal,
              contentHint: ContentHint.RESENDABLE,
              groupSendOptions: {
                groupV2: groupV2Info,
                reaction: reactionForSend,
                timestamp: pendingReaction.timestamp,
                expireTimer,
                profileKey,
              },
              messageId,
              sendOptions,
              sendTarget: conversation.toSenderKeyTarget(),
              sendType: 'reaction',
              urgent: true,
            });
          }
        );
      }

      await ephemeralMessageForReactionSend.send({
        promise: handleMessageSend(promise, {
          messageIds: [messageId],
          sendType: 'reaction',
        }),
        saveErrors,
        targetTimestamp: pendingReaction.timestamp,
      });

      // Because message.send swallows and processes errors, we'll await the inner promise
      //   to get the SendMessageProtoError, which gives us information upstream
      ///  processors need to detect certain kinds of errors.
      try {
        await promise;
      } catch (error) {
        if (error instanceof Error) {
          originalError = error;
        } else {
          log.error(
            `promise threw something other than an error: ${Errors.toLogFormat(
              error
            )}`
          );
        }
      }

      didFullySend = true;
      const reactionSendStateByConversationId =
        ephemeralMessageForReactionSend.get('sendStateByConversationId') || {};
      for (const [conversationId, sendState] of Object.entries(
        reactionSendStateByConversationId
      )) {
        if (isSent(sendState.status)) {
          successfulConversationIds.add(conversationId);
        } else {
          didFullySend = false;
        }
      }

      if (!ephemeralMessageForReactionSend.doNotSave) {
        const reactionMessage = ephemeralMessageForReactionSend;

        await reactionMessage.hydrateStoryContext(message.attributes, {
          shouldSave: false,
        });
        await DataWriter.saveMessage(reactionMessage.attributes, {
          ourAci,
          forceSave: true,
        });

        void conversation.addSingleMessage(
          window.MessageCache.__DEPRECATED$register(
            reactionMessage.id,
            reactionMessage,
            'sendReaction'
          )
        );
      }
    }

    const newReactions = reactionUtil.markOutgoingReactionSent(
      getReactions(message),
      pendingReaction,
      successfulConversationIds
    );
    setReactions(message, newReactions);

    if (!didFullySend) {
      throw new Error('reaction did not fully send');
    }
  } catch (thrownError: unknown) {
    await handleMultipleSendErrors({
      errors: [thrownError, ...sendErrors],
      isFinalAttempt,
      log,
      markFailed: () => markReactionFailed(message, pendingReaction),
      timeRemaining,
      // In the case of a failed group send thrownError will not be SentMessageProtoError,
      //   but we should have been able to harvest the original error. In the Note to Self
      //   send case, thrownError will be the error we care about, and we won't have an
      //   originalError.
      toThrow: originalError || thrownError,
    });
  } finally {
    await DataWriter.saveMessage(message.attributes, { ourAci });
  }
}

const getReactions = (
  message: MessageModel
): ReadonlyArray<MessageReactionType> => message.get('reactions') || [];

const setReactions = (
  message: MessageModel,
  reactions: Array<MessageReactionType>
): void => {
  if (reactions.length) {
    message.set('reactions', reactions);
  } else {
    message.set('reactions', undefined);
  }
};

function getRecipients(
  log: LoggerType,
  reaction: Readonly<MessageReactionType>,
  conversation: ConversationModel
): {
  allRecipientServiceIds: Array<ServiceIdString>;
  recipientServiceIdsWithoutMe: Array<ServiceIdString>;
  untrustedServiceIds: Array<ServiceIdString>;
} {
  const allRecipientServiceIds: Array<ServiceIdString> = [];
  const recipientServiceIdsWithoutMe: Array<ServiceIdString> = [];
  const untrustedServiceIds: Array<ServiceIdString> = [];

  const currentConversationRecipients = conversation.getMemberConversationIds();

  for (const id of reactionUtil.getUnsentConversationIds(reaction)) {
    const recipient = window.ConversationController.get(id);
    if (!recipient) {
      continue;
    }

    const recipientIdentifier = recipient.getSendTarget();
    const isRecipientMe = isMe(recipient.attributes);

    if (
      !recipientIdentifier ||
      (!currentConversationRecipients.has(id) && !isRecipientMe)
    ) {
      continue;
    }

    if (recipient.isUntrusted()) {
      const serviceId = recipient.getServiceId();
      if (!serviceId) {
        log.error(
          `sendReaction/getRecipients: Untrusted conversation ${recipient.idForLogging()} missing serviceId.`
        );
        continue;
      }
      untrustedServiceIds.push(serviceId);
      continue;
    }
    if (recipient.isUnregistered()) {
      continue;
    }
    if (recipient.isBlocked()) {
      continue;
    }

    allRecipientServiceIds.push(recipientIdentifier);
    if (!isRecipientMe) {
      recipientServiceIdsWithoutMe.push(recipientIdentifier);
    }
  }

  return {
    allRecipientServiceIds,
    recipientServiceIdsWithoutMe,
    untrustedServiceIds,
  };
}

function markReactionFailed(
  message: MessageModel,
  pendingReaction: MessageReactionType
): void {
  const newReactions = reactionUtil.markOutgoingReactionFailed(
    getReactions(message),
    pendingReaction
  );
  setReactions(message, newReactions);
}
