// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import type PQueue from 'p-queue';
import { repeat, zipObject } from '../util/iterables';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import * as durations from '../util/durations';

import type { LoggerType } from '../types/Logging';
import type { CallbackResultType } from '../textsecure/Types.d';
import type { MessageModel } from '../models/messages';
import type { MessageReactionType } from '../model-types.d';
import type { ConversationModel } from '../models/conversations';

import * as reactionUtil from '../reactions/util';
import { isSent, SendStatus } from '../messages/MessageSendState';
import { getMessageById } from '../messages/getMessageById';
import { isMe, isDirectConversation } from '../util/whatTypeOfConversation';
import { getSendOptions } from '../util/getSendOptions';
import { SignalService as Proto } from '../protobuf';
import { handleMessageSend } from '../util/handleMessageSend';
import { ourProfileKeyService } from '../services/ourProfileKey';
import { canReact } from '../state/selectors/message';
import { findAndFormatContact } from '../util/findAndFormatContact';
import { UUID } from '../types/UUID';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { handleMultipleSendErrors } from './helpers/handleMultipleSendErrors';
import { InMemoryQueues } from './helpers/InMemoryQueues';

const MAX_RETRY_TIME = durations.DAY;
const MAX_ATTEMPTS = exponentialBackoffMaxAttempts(MAX_RETRY_TIME);

const reactionJobData = z.object({
  messageId: z.string(),
});

export type ReactionJobData = z.infer<typeof reactionJobData>;

export class ReactionJobQueue extends JobQueue<ReactionJobData> {
  private readonly inMemoryQueues = new InMemoryQueues();

  protected parseData(data: unknown): ReactionJobData {
    return reactionJobData.parse(data);
  }

  protected override getInMemoryQueue({
    data,
  }: Readonly<{ data: Pick<ReactionJobData, 'messageId'> }>): PQueue {
    return this.inMemoryQueues.get(data.messageId);
  }

  protected async run(
    { data, timestamp }: Readonly<{ data: ReactionJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    const { messageId } = data;
    const ourUuid = window.textsecure.storage.user.getCheckedUuid().toString();

    const timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();
    const isFinalAttempt = attempt >= MAX_ATTEMPTS;

    // We don't immediately use this value because we may want to mark the reaction
    //   failed before doing so.
    const shouldContinue = await commonShouldJobContinue({
      attempt,
      log,
      timeRemaining,
    });

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

    if (
      !canReact(message.attributes, ourConversationId, findAndFormatContact)
    ) {
      log.info(
        `could not react to ${messageId}. Removing this pending reaction`
      );
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

    try {
      const conversation = message.getConversation();
      if (!conversation) {
        throw new Error(
          `could not find conversation for message with ID ${messageId}`
        );
      }

      const { allRecipientIdentifiers, recipientIdentifiersWithoutMe } =
        getRecipients(pendingReaction, conversation);

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
        id: UUID.generate.toString(),
        type: 'outgoing',
        conversationId: conversation.get('id'),
        sent_at: pendingReaction.timestamp,
        received_at: window.Signal.Util.incrementMessageCounter(),
        received_at_ms: pendingReaction.timestamp,
        reaction: reactionForSend,
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

      let didFullySend: boolean;
      const successfulConversationIds = new Set<string>();

      if (recipientIdentifiersWithoutMe.length === 0) {
        log.info('sending sync reaction message only');
        const dataMessage = await window.textsecure.messaging.getDataMessage({
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
          log.info('sending direct reaction message');
          promise = window.textsecure.messaging.sendMessageToIdentifier({
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
          });
        } else {
          log.info('sending group reaction message');
          promise = window.Signal.Util.sendToGroup({
            contentHint: ContentHint.RESENDABLE,
            groupSendOptions: {
              groupV1: conversation.getGroupV1Info(
                recipientIdentifiersWithoutMe
              ),
              groupV2: conversation.getGroupV2Info({
                members: recipientIdentifiersWithoutMe,
              }),
              reaction: reactionForSend,
              timestamp: pendingReaction.timestamp,
              expireTimer,
              profileKey,
            },
            messageId,
            sendOptions,
            sendTarget: conversation.toSenderKeyTarget(),
            sendType: 'reaction',
          });
        }

        await ephemeralMessageForReactionSend.send(
          handleMessageSend(promise, {
            messageIds: [messageId],
            sendType: 'reaction',
          }),
          saveErrors
        );

        didFullySend = true;
        const reactionSendStateByConversationId =
          ephemeralMessageForReactionSend.get('sendStateByConversationId') ||
          {};
        for (const [conversationId, sendState] of Object.entries(
          reactionSendStateByConversationId
        )) {
          if (isSent(sendState.status)) {
            successfulConversationIds.add(conversationId);
          } else {
            didFullySend = false;
          }
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
      });
    } finally {
      await window.Signal.Data.saveMessage(message.attributes, { ourUuid });
    }
  }
}

export const reactionJobQueue = new ReactionJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'reactions',
  maxAttempts: MAX_ATTEMPTS,
});

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
  reaction: Readonly<MessageReactionType>,
  conversation: ConversationModel
): {
  allRecipientIdentifiers: Array<string>;
  recipientIdentifiersWithoutMe: Array<string>;
} {
  const allRecipientIdentifiers: Array<string> = [];
  const recipientIdentifiersWithoutMe: Array<string> = [];

  const currentConversationRecipients =
    conversation.getRecipientConversationIds();

  for (const id of reactionUtil.getUnsentConversationIds(reaction)) {
    const recipient = window.ConversationController.get(id);
    if (!recipient) {
      continue;
    }

    const recipientIdentifier = recipient.getSendTarget();
    const isRecipientMe = isMe(recipient.attributes);

    if (
      !recipientIdentifier ||
      recipient.isUntrusted() ||
      (!currentConversationRecipients.has(id) && !isRecipientMe)
    ) {
      continue;
    }

    allRecipientIdentifiers.push(recipientIdentifier);
    if (!isRecipientMe) {
      recipientIdentifiersWithoutMe.push(recipientIdentifier);
    }
  }

  return { allRecipientIdentifiers, recipientIdentifiersWithoutMe };
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
