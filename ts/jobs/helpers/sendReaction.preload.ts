// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { ContentHint } from '@signalapp/libsignal-client';

import * as Errors from '../../types/errors.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { repeat, zipObject } from '../../util/iterables.std.js';
import type { CallbackResultType } from '../../textsecure/Types.d.ts';
import { MessageModel } from '../../models/messages.preload.js';
import type { MessageReactionType } from '../../model-types.d.ts';
import type { ConversationModel } from '../../models/conversations.preload.js';

import * as reactionUtil from '../../reactions/util.std.js';
import { isSent, SendStatus } from '../../messages/MessageSendState.std.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import { isIncoming } from '../../messages/helpers.std.js';
import {
  isMe,
  isDirectConversation,
  isGroupV2,
} from '../../util/whatTypeOfConversation.dom.js';
import { getSendOptions } from '../../util/getSendOptions.preload.js';
import { handleMessageSend } from '../../util/handleMessageSend.preload.js';
import { ourProfileKeyService } from '../../services/ourProfileKey.std.js';
import { canReact, isStory } from '../../state/selectors/message.preload.js';
import { findAndFormatContact } from '../../util/findAndFormatContact.preload.js';
import type { AciString, ServiceIdString } from '../../types/ServiceId.std.js';
import { isAciString } from '../../util/isAciString.std.js';
import { handleMultipleSendErrors } from './handleMultipleSendErrors.std.js';
import { incrementMessageCounter } from '../../util/incrementMessageCounter.preload.js';
import { generateMessageId } from '../../util/generateMessageId.node.js';

import type {
  ConversationQueueJobBundle,
  ReactionJobData,
} from '../conversationJobQueue.preload.js';
import { isConversationAccepted } from '../../util/isConversationAccepted.preload.js';
import { isConversationUnregistered } from '../../util/isConversationUnregistered.dom.js';
import type { LoggerType } from '../../types/Logging.std.js';
import { sendToGroup } from '../../util/sendToGroup.preload.js';
import { hydrateStoryContext } from '../../util/hydrateStoryContext.preload.js';
import { send, sendSyncMessageOnly } from '../../messages/send.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { isNumber } = lodash;

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
  const ourAci = itemStorage.user.getCheckedAci();

  await window.ConversationController.load();

  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();

  const message = await getMessageById(messageId);
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
    await window.MessageCache.saveMessage(message.attributes);
    return;
  }

  if (!shouldContinue) {
    log.info(
      `reacting to message ${messageId} ran out of time. Giving up on sending it`
    );
    markReactionFailed(message, pendingReaction);
    await window.MessageCache.saveMessage(message.attributes);
    return;
  }

  let sendErrors: Array<Error> = [];
  const saveErrors = (errors: Array<Error>): void => {
    sendErrors = errors;
  };

  let originalError: Error | undefined;

  try {
    const messageConversation = window.ConversationController.get(
      message.get('conversationId')
    );
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
    const ephemeralMessageForReactionSend = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      type: 'outgoing',
      conversationId: conversation.get('id'),
      sent_at: pendingReaction.timestamp,
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

    ephemeralMessageForReactionSend.doNotSave = true;

    // Adds the reaction's attributes to the message cache so that we can
    // safely `set` on it later.
    window.MessageCache.register(ephemeralMessageForReactionSend);

    let didFullySend: boolean;
    const successfulConversationIds = new Set<string>();

    if (recipientServiceIdsWithoutMe.length === 0) {
      log.info('sending sync reaction message only');
      const dataMessage = await messaging.getDataOrEditMessage({
        attachments: [],
        expireTimer,
        expireTimerVersion: conversation.getExpireTimerVersion(),
        groupV2: conversation.getGroupV2Info({
          members: recipientServiceIdsWithoutMe,
        }),
        preview: [],
        profileKey,
        reaction: reactionForSend,
        recipients: allRecipientServiceIds,
        timestamp: pendingReaction.timestamp,
      });
      await sendSyncMessageOnly(ephemeralMessageForReactionSend, {
        dataMessage,
        saveErrors,
        targetTimestamp: pendingReaction.timestamp,
      });

      didFullySend = true;
      successfulConversationIds.add(ourConversationId);
    } else {
      const sendOptions = await getSendOptions(conversation.attributes);

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
          expireTimerVersion: conversation.getExpireTimerVersion(),
          contentHint: ContentHint.Resendable,
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
              contentHint: ContentHint.Resendable,
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

      await send(ephemeralMessageForReactionSend, {
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

        await hydrateStoryContext(reactionMessage.id, message.attributes, {
          shouldSave: false,
        });
        await window.MessageCache.saveMessage(reactionMessage.attributes, {
          forceSave: true,
        });

        window.MessageCache.register(reactionMessage);
        void conversation.addSingleMessage(reactionMessage.attributes);
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
    await window.MessageCache.saveMessage(message.attributes);
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
    message.set({ reactions });
  } else {
    message.set({ reactions: undefined });
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
          `getRecipients: Untrusted conversation ${recipient.idForLogging()} missing serviceId.`
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
