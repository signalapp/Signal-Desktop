// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

import * as Errors from '../../types/errors';
import { repeat, zipObject } from '../../util/iterables';
import type { CallbackResultType } from '../../textsecure/Types.d';
import type { MessageModel } from '../../models/messages';
import type { MessageReactionType } from '../../model-types.d';
import type { ConversationModel } from '../../models/conversations';

import * as reactionUtil from '../../reactions/util';
import { isSent, SendStatus } from '../../messages/MessageSendState';
import { getMessageById } from '../../messages/getMessageById';
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
import { UUID } from '../../types/UUID';
import { handleMultipleSendErrors } from './handleMultipleSendErrors';
import { incrementMessageCounter } from '../../util/incrementMessageCounter';

import type {
  ConversationQueueJobBundle,
  ReactionJobData,
} from '../conversationJobQueue';
import { isConversationAccepted } from '../../util/isConversationAccepted';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import type { LoggerType } from '../../types/Logging';

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
  const ourUuid = window.textsecure.storage.user.getCheckedUuid().toString();

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
    await window.Signal.Data.saveMessage(message.attributes, { ourUuid });
    return;
  }

  if (!shouldContinue) {
    log.info(
      `reacting to message ${messageId} ran out of time. Giving up on sending it`
    );
    markReactionFailed(message, pendingReaction);
    await window.Signal.Data.saveMessage(message.attributes, { ourUuid });
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

    const {
      allRecipientIdentifiers,
      recipientIdentifiersWithoutMe,
      untrustedUuids,
    } = getRecipients(log, pendingReaction, conversation);

    if (untrustedUuids.length) {
      window.reduxActions.conversations.conversationStoppedByMissingVerification(
        {
          conversationId: conversation.id,
          untrustedUuids,
        }
      );
      throw new Error(
        `Reaction for message ${messageId} sending blocked because ${untrustedUuids.length} conversation(s) were untrusted. Failing this attempt.`
      );
    }

    const expireTimer = message.get('expireTimer');
    const profileKey = conversation.get('profileSharing')
      ? await ourProfileKeyService.get()
      : undefined;

    const reactionForSend = pendingReaction.emoji
      ? pendingReaction
      : {
          ...pendingReaction,
          emoji: emojiToRemove,
          remove: true,
        };

    const ephemeralMessageForReactionSend = new window.Whisper.Message({
      id: UUID.generate().toString(),
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

    if (
      isStory(message.attributes) &&
      isDirectConversation(conversation.attributes)
    ) {
      ephemeralMessageForReactionSend.set({
        storyId: message.id,
        storyReactionEmoji: reactionForSend.emoji,
      });
    } else {
      ephemeralMessageForReactionSend.doNotSave = true;
    }

    let didFullySend: boolean;
    const successfulConversationIds = new Set<string>();

    if (recipientIdentifiersWithoutMe.length === 0) {
      log.info('sending sync reaction message only');
      const dataMessage = await messaging.getDataMessage({
        attachments: [],
        expireTimer,
        groupV2: conversation.getGroupV2Info({
          members: recipientIdentifiersWithoutMe,
        }),
        preview: [],
        profileKey,
        reaction: reactionForSend,
        recipients: allRecipientIdentifiers,
        timestamp: pendingReaction.timestamp,
      });
      await ephemeralMessageForReactionSend.sendSyncMessageOnly(
        dataMessage,
        saveErrors
      );

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
        promise = messaging.sendMessageToIdentifier({
          identifier: recipientIdentifiersWithoutMe[0],
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
          storyContext: isStory(message.attributes)
            ? {
                authorUuid: message.get('sourceUuid'),
                timestamp: message.get('sent_at'),
              }
            : undefined,
          urgent: true,
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
              members: recipientIdentifiersWithoutMe,
            });
            if (groupV2Info && isNumber(revision)) {
              groupV2Info.revision = revision;
            }

            return window.Signal.Util.sendToGroup({
              abortSignal,
              contentHint: ContentHint.RESENDABLE,
              groupSendOptions: {
                groupV1: conversation.getGroupV1Info(
                  recipientIdentifiersWithoutMe
                ),
                groupV2: groupV2Info,
                reaction: reactionForSend,
                timestamp: pendingReaction.timestamp,
                expireTimer,
                profileKey,
                storyContext: isStory(message.attributes)
                  ? {
                      authorUuid: message.get('sourceUuid'),
                      timestamp: message.get('sent_at'),
                    }
                  : undefined,
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

      await ephemeralMessageForReactionSend.send(
        handleMessageSend(promise, {
          messageIds: [messageId],
          sendType: 'reaction',
        }),
        saveErrors
      );

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

        await Promise.all([
          await window.Signal.Data.saveMessage(reactionMessage.attributes, {
            ourUuid,
            forceSave: true,
          }),
          reactionMessage.hydrateStoryContext(message),
        ]);

        conversation.addSingleMessage(
          window.MessageController.register(reactionMessage.id, reactionMessage)
        );
      }
    }

    const newReactions = reactionUtil.markOutgoingReactionSent(
      getReactions(message),
      pendingReaction,
      successfulConversationIds,
      message.attributes
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
    await window.Signal.Data.saveMessage(message.attributes, { ourUuid });
  }
}

const getReactions = (message: MessageModel): Array<MessageReactionType> =>
  message.get('reactions') || [];

const setReactions = (
  message: MessageModel,
  reactions: Array<MessageReactionType>
): void => {
  if (reactions.length) {
    message.set('reactions', reactions);
  } else {
    message.unset('reactions');
  }
};

function getRecipients(
  log: LoggerType,
  reaction: Readonly<MessageReactionType>,
  conversation: ConversationModel
): {
  allRecipientIdentifiers: Array<string>;
  recipientIdentifiersWithoutMe: Array<string>;
  untrustedUuids: Array<string>;
} {
  const allRecipientIdentifiers: Array<string> = [];
  const recipientIdentifiersWithoutMe: Array<string> = [];
  const untrustedUuids: Array<string> = [];

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
      const uuid = recipient.get('uuid');
      if (!uuid) {
        log.error(
          `sendReaction/getRecipients: Untrusted conversation ${recipient.idForLogging()} missing UUID.`
        );
        continue;
      }
      untrustedUuids.push(uuid);
      continue;
    }
    if (recipient.isUnregistered()) {
      untrustedUuids.push(recipientIdentifier);
      continue;
    }

    allRecipientIdentifiers.push(recipientIdentifier);
    if (!isRecipientMe) {
      recipientIdentifiersWithoutMe.push(recipientIdentifier);
    }
  }

  return {
    allRecipientIdentifiers,
    recipientIdentifiersWithoutMe,
    untrustedUuids,
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
