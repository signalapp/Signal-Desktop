// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';
import type { ConversationModel } from '../../models/conversations';
import type {
  ConversationQueueJobBundle,
  StoryJobData,
} from '../conversationJobQueue';
import type { LoggerType } from '../../types/Logging';
import type { MessageModel } from '../../models/messages';
import type { SenderKeyInfoType } from '../../model-types.d';
import type {
  SendState,
  SendStateByConversationId,
} from '../../messages/MessageSendState';
import type { UUIDStringType } from '../../types/UUID';
import * as Errors from '../../types/errors';
import dataInterface from '../../sql/Client';
import { SignalService as Proto } from '../../protobuf';
import { getMessageById } from '../../messages/getMessageById';
import {
  getSendOptions,
  getSendOptionsForRecipients,
} from '../../util/getSendOptions';
import { handleMessageSend } from '../../util/handleMessageSend';
import { handleMultipleSendErrors } from './handleMultipleSendErrors';
import { isMe } from '../../util/whatTypeOfConversation';
import { isNotNil } from '../../util/isNotNil';
import { isSent } from '../../messages/MessageSendState';
import { ourProfileKeyService } from '../../services/ourProfileKey';
import { sendContentMessageToGroup } from '../../util/sendToGroup';

export async function sendStory(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: StoryJobData
): Promise<void> {
  const { messageIds, textAttachment, timestamp } = data;

  const profileKey = await ourProfileKeyService.get();

  if (!profileKey) {
    log.info('stories.sendStory: no profile key cannot send');
    return;
  }

  // Some distribution lists need allowsReplies false, some need it set to true
  // we create this proto (for the sync message) and also to re-use some of the
  // attributes inside it.
  const originalStoryMessage = await messaging.getStoryMessage({
    allowsReplies: true,
    textAttachment,
    profileKey,
  });

  const accSendStateByConversationId = new Map<string, SendState>();
  const canReplyUuids = new Set<string>();
  const recipientsByUuid = new Map<string, Set<string>>();

  // This function is used to keep track of all the recipients so once we're
  // done with our send we can build up the storyMessageRecipients object for
  // sending in the sync message.
  function processStoryMessageRecipient(
    listId: string,
    uuid: string,
    canReply?: boolean
  ): void {
    if (conversation.get('uuid') === uuid) {
      return;
    }

    const distributionListIds = recipientsByUuid.get(uuid) || new Set<string>();

    recipientsByUuid.set(uuid, new Set([...distributionListIds, listId]));

    if (canReply) {
      canReplyUuids.add(uuid);
    }
  }

  // Since some contacts will be duplicated across lists but we won't be sending
  // duplicate messages we need to ensure that sendStateByConversationId is kept
  // in sync across all messages.
  async function maybeUpdateMessageSendState(
    message: MessageModel
  ): Promise<void> {
    const oldSendStateByConversationId =
      message.get('sendStateByConversationId') || {};

    const newSendStateByConversationId = Object.keys(
      oldSendStateByConversationId
    ).reduce((acc, conversationId) => {
      const sendState = accSendStateByConversationId.get(conversationId);
      if (sendState) {
        return {
          ...acc,
          [conversationId]: sendState,
        };
      }

      return acc;
    }, {} as SendStateByConversationId);

    if (isEqual(oldSendStateByConversationId, newSendStateByConversationId)) {
      return;
    }

    message.set('sendStateByConversationId', newSendStateByConversationId);
    await window.Signal.Data.saveMessage(message.attributes, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
  }

  let isSyncMessageUpdate = false;

  // Send to all distribution lists
  await Promise.all(
    messageIds.map(async messageId => {
      const message = await getMessageById(messageId);
      if (!message) {
        log.info(
          `stories.sendStory: message ${messageId} was not found, maybe because it was deleted. Giving up on sending it`
        );
        return;
      }

      const messageConversation = message.getConversation();
      if (messageConversation !== conversation) {
        log.error(
          `stories.sendStory: Message conversation '${messageConversation?.idForLogging()}' does not match job conversation ${conversation.idForLogging()}`
        );
        return;
      }

      if (message.isErased() || message.get('deletedForEveryone')) {
        log.info(
          `stories.sendStory: message ${messageId} was erased. Giving up on sending it`
        );
        return;
      }

      const listId = message.get('storyDistributionListId');

      if (!listId) {
        log.info(
          `stories.sendStory: message ${messageId} does not have a storyDistributionListId. Giving up on sending it`
        );
        return;
      }

      const distributionList =
        await dataInterface.getStoryDistributionWithMembers(listId);

      if (!distributionList) {
        log.info(
          `stories.sendStory: Distribution list ${listId} was not found. Giving up on sending message ${messageId}`
        );
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
        log.info(
          `stories.sendStory: message ${messageId} ran out of time. Giving up on sending it`
        );
        await markMessageFailed(message, [
          new Error('Message send ran out of time'),
        ]);
        return;
      }

      let originalError: Error | undefined;

      const {
        allRecipientIdentifiers,
        allowedReplyByUuid,
        recipientIdentifiersWithoutMe,
        sentRecipientIdentifiers,
        untrustedUuids,
      } = getMessageRecipients({
        log,
        message,
      });

      try {
        if (untrustedUuids.length) {
          window.reduxActions.conversations.conversationStoppedByMissingVerification(
            {
              conversationId: conversation.id,
              untrustedUuids,
            }
          );
          throw new Error(
            `stories.sendStory: Message ${messageId} sending blocked because ${untrustedUuids.length} conversation(s) were untrusted. Failing this attempt.`
          );
        }

        if (
          !allRecipientIdentifiers.length ||
          !recipientIdentifiersWithoutMe.length
        ) {
          log.info(
            `stories.sendStory: trying to send message ${messageId} but it looks like it was already sent to everyone.`
          );
          sentRecipientIdentifiers.forEach(uuid =>
            processStoryMessageRecipient(
              listId,
              uuid,
              allowedReplyByUuid.get(uuid)
            )
          );
          await maybeUpdateMessageSendState(message);
          return;
        }

        const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

        const recipientsSet = new Set(recipientIdentifiersWithoutMe);

        const sendOptions = await getSendOptionsForRecipients(
          recipientIdentifiersWithoutMe
        );

        log.info(
          'stories.sendStory: sending story to distribution list',
          listId
        );

        const storyMessage = new Proto.StoryMessage();
        storyMessage.profileKey = originalStoryMessage.profileKey;
        storyMessage.fileAttachment = originalStoryMessage.fileAttachment;
        storyMessage.textAttachment = originalStoryMessage.textAttachment;
        storyMessage.group = originalStoryMessage.group;
        storyMessage.allowsReplies = Boolean(distributionList.allowsReplies);

        const contentMessage = new Proto.Content();
        contentMessage.storyMessage = storyMessage;

        const innerPromise = sendContentMessageToGroup({
          contentHint: ContentHint.IMPLICIT,
          contentMessage,
          isPartialSend: false,
          messageId: undefined,
          recipients: recipientIdentifiersWithoutMe,
          sendOptions,
          sendTarget: {
            getGroupId: () => undefined,
            getMembers: () =>
              recipientIdentifiersWithoutMe
                .map(uuid => window.ConversationController.get(uuid))
                .filter(isNotNil),
            hasMember: (uuid: UUIDStringType) => recipientsSet.has(uuid),
            idForLogging: () => `dl(${listId})`,
            isGroupV2: () => true,
            isValid: () => true,
            getSenderKeyInfo: () => distributionList.senderKeyInfo,
            saveSenderKeyInfo: async (senderKeyInfo: SenderKeyInfoType) =>
              dataInterface.modifyStoryDistribution({
                ...distributionList,
                senderKeyInfo,
              }),
          },
          sendType: 'story',
          timestamp,
          urgent: false,
        });

        message.doNotSendSyncMessage = true;

        const messageSendPromise = message.send(
          handleMessageSend(innerPromise, {
            messageIds: [messageId],
            sendType: 'story',
          }),
          saveErrors
        );

        // Because message.send swallows and processes errors, we'll await the
        // inner promise to get the SendMessageProtoError, which gives us
        // information upstream processors need to detect certain kinds of situations.
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

        await messageSendPromise;

        // Track sendState across message sends so that we can update all
        // subsequent messages.
        const sendStateByConversationId =
          message.get('sendStateByConversationId') || {};
        Object.entries(sendStateByConversationId).forEach(
          ([recipientConversationId, sendState]) => {
            if (accSendStateByConversationId.has(recipientConversationId)) {
              return;
            }

            accSendStateByConversationId.set(
              recipientConversationId,
              sendState
            );
          }
        );

        const didFullySend =
          !messageSendErrors.length || didSendToEveryone(message);
        if (!didFullySend) {
          throw new Error('message did not fully send');
        }
      } catch (thrownError: unknown) {
        const errors = [thrownError, ...messageSendErrors];
        await handleMultipleSendErrors({
          errors,
          isFinalAttempt,
          log,
          markFailed: () => markMessageFailed(message, messageSendErrors),
          timeRemaining,
          // In the case of a failed group send thrownError will not be
          // SentMessageProtoError, but we should have been able to harvest
          // the original error. In the Note to Self send case, thrownError
          // will be the error we care about, and we won't have an originalError.
          toThrow: originalError || thrownError,
        });
      } finally {
        recipientIdentifiersWithoutMe.forEach(uuid =>
          processStoryMessageRecipient(
            listId,
            uuid,
            allowedReplyByUuid.get(uuid)
          )
        );
        // Greater than 1 because our own conversation will always count as "sent"
        isSyncMessageUpdate = sentRecipientIdentifiers.length > 1;
        await maybeUpdateMessageSendState(message);
      }
    })
  );

  // Send the sync message
  const storyMessageRecipients: Array<{
    destinationUuid: string;
    distributionListIds: Array<string>;
    isAllowedToReply: boolean;
  }> = [];
  recipientsByUuid.forEach((distributionListIds, destinationUuid) => {
    storyMessageRecipients.push({
      destinationUuid,
      distributionListIds: Array.from(distributionListIds),
      isAllowedToReply: canReplyUuids.has(destinationUuid),
    });
  });

  const options = await getSendOptions(conversation.attributes, {
    syncMessage: true,
  });

  messaging.sendSyncMessage({
    destination: conversation.get('e164'),
    destinationUuid: conversation.get('uuid'),
    storyMessage: originalStoryMessage,
    storyMessageRecipients,
    expirationStartTimestamp: null,
    isUpdate: isSyncMessageUpdate,
    options,
    timestamp,
    urgent: false,
  });
}

function getMessageRecipients({
  log,
  message,
}: Readonly<{
  log: LoggerType;
  message: MessageModel;
}>): {
  allRecipientIdentifiers: Array<string>;
  allowedReplyByUuid: Map<string, boolean>;
  recipientIdentifiersWithoutMe: Array<string>;
  sentRecipientIdentifiers: Array<string>;
  untrustedUuids: Array<string>;
} {
  const allRecipientIdentifiers: Array<string> = [];
  const recipientIdentifiersWithoutMe: Array<string> = [];
  const untrustedUuids: Array<string> = [];
  const sentRecipientIdentifiers: Array<string> = [];
  const allowedReplyByUuid = new Map<string, boolean>();

  Object.entries(message.get('sendStateByConversationId') || {}).forEach(
    ([recipientConversationId, sendState]) => {
      if (sendState.isAlreadyIncludedInAnotherDistributionList) {
        return;
      }

      const recipient = window.ConversationController.get(
        recipientConversationId
      );
      if (!recipient) {
        return;
      }

      const isRecipientMe = isMe(recipient.attributes);

      if (recipient.isUntrusted()) {
        const uuid = recipient.get('uuid');
        if (!uuid) {
          log.error(
            `stories.sendStory/getMessageRecipients: Untrusted conversation ${recipient.idForLogging()} missing UUID.`
          );
          return;
        }
        untrustedUuids.push(uuid);
        return;
      }
      if (recipient.isUnregistered()) {
        return;
      }

      const recipientIdentifier = recipient.getSendTarget();
      if (!recipientIdentifier) {
        return;
      }

      allowedReplyByUuid.set(
        recipientIdentifier,
        Boolean(sendState.isAllowedToReplyToStory)
      );

      if (isSent(sendState.status)) {
        sentRecipientIdentifiers.push(recipientIdentifier);
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
    allowedReplyByUuid,
    recipientIdentifiersWithoutMe,
    sentRecipientIdentifiers,
    untrustedUuids,
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
