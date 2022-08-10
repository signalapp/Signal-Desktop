// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';
import type {
  AttachmentWithHydratedData,
  TextAttachmentType,
} from '../../types/Attachment';
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
import { isGroupV2, isMe } from '../../util/whatTypeOfConversation';
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
  const { messageIds, timestamp } = data;

  const profileKey = await ourProfileKeyService.get();

  if (!profileKey) {
    log.info('stories.sendStory: no profile key cannot send');
    return;
  }

  // We want to generate the StoryMessage proto once at the top level so we
  // can reuse it but first we'll need textAttachment | fileAttachment.
  // This function pulls off the attachment and generates the proto from the
  // first message on the list prior to continuing.
  const originalStoryMessage = await (async (): Promise<
    Proto.StoryMessage | undefined
  > => {
    const [messageId] = messageIds;
    const message = await getMessageById(messageId);
    if (!message) {
      log.info(
        `stories.sendStory(${messageId}): message was not found, maybe because it was deleted. Giving up on sending it`
      );
      return;
    }

    const messageConversation = message.getConversation();
    if (messageConversation !== conversation) {
      log.error(
        `stories.sendStory(${messageId}): Message conversation '${messageConversation?.idForLogging()}' does not match job conversation ${conversation.idForLogging()}`
      );
      return;
    }

    const attachments = message.get('attachments') || [];
    const [attachment] = attachments;

    if (!attachment) {
      log.info(
        `stories.sendStory(${messageId}): message does not have any attachments to send. Giving up on sending it`
      );
      return;
    }

    let textAttachment: TextAttachmentType | undefined;
    let fileAttachment: AttachmentWithHydratedData | undefined;

    if (attachment.textAttachment) {
      textAttachment = attachment.textAttachment;
    } else {
      fileAttachment = await window.Signal.Migrations.loadAttachmentData(
        attachment
      );
    }

    const groupV2 = isGroupV2(conversation.attributes)
      ? conversation.getGroupV2Info()
      : undefined;

    // Some distribution lists need allowsReplies false, some need it set to true
    // we create this proto (for the sync message) and also to re-use some of the
    // attributes inside it.
    return messaging.getStoryMessage({
      allowsReplies: true,
      fileAttachment,
      groupV2,
      textAttachment,
      profileKey,
    });
  })();

  if (!originalStoryMessage) {
    return;
  }

  const canReplyUuids = new Set<string>();
  const recipientsByUuid = new Map<string, Set<string>>();
  const sentConversationIds = new Map<string, SendState>();
  const sentUuids = new Set<string>();

  // This function is used to keep track of all the recipients so once we're
  // done with our send we can build up the storyMessageRecipients object for
  // sending in the sync message.
  function addDistributionListToUuidSent(
    listId: string | undefined,
    uuid: string,
    canReply?: boolean
  ): void {
    if (conversation.get('uuid') === uuid) {
      return;
    }

    const distributionListIds = recipientsByUuid.get(uuid) || new Set<string>();

    if (listId) {
      recipientsByUuid.set(uuid, new Set([...distributionListIds, listId]));
    } else {
      recipientsByUuid.set(uuid, distributionListIds);
    }

    if (canReply) {
      canReplyUuids.add(uuid);
    }
  }

  let isSyncMessageUpdate = false;

  // Send to all distribution lists
  await Promise.all(
    messageIds.map(async messageId => {
      const message = await getMessageById(messageId);
      if (!message) {
        log.info(
          `stories.sendStory(${messageId}): message was not found, maybe because it was deleted. Giving up on sending it`
        );
        return;
      }

      const messageConversation = message.getConversation();
      if (messageConversation !== conversation) {
        log.error(
          `stories.sendStory(${messageId}): Message conversation '${messageConversation?.idForLogging()}' does not match job conversation ${conversation.idForLogging()}`
        );
        return;
      }

      if (message.isErased() || message.get('deletedForEveryone')) {
        log.info(
          `stories.sendStory(${messageId}): message was erased. Giving up on sending it`
        );
        return;
      }

      const listId = message.get('storyDistributionListId');
      const receiverId = isGroupV2(messageConversation.attributes)
        ? messageConversation.id
        : listId;

      if (!receiverId) {
        log.info(
          `stories.sendStory(${messageId}): did not get a valid recipient ID for message. Giving up on sending it`
        );
        return;
      }

      const distributionList = isGroupV2(messageConversation.attributes)
        ? undefined
        : await dataInterface.getStoryDistributionWithMembers(receiverId);

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
          `stories.sendStory(${messageId}): ran out of time. Giving up on sending it`
        );
        await markMessageFailed(message, [
          new Error('Message send ran out of time'),
        ]);
        return;
      }

      let originalError: Error | undefined;

      const {
        allRecipientIds,
        allowedReplyByUuid,
        pendingSendRecipientIds,
        sentRecipientIds,
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
            `stories.sendStory(${messageId}): sending blocked because ${untrustedUuids.length} conversation(s) were untrusted. Failing this attempt.`
          );
        }

        if (!pendingSendRecipientIds.length) {
          allRecipientIds.forEach(uuid =>
            addDistributionListToUuidSent(
              listId,
              uuid,
              allowedReplyByUuid.get(uuid)
            )
          );
          return;
        }

        const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

        const recipientsSet = new Set(pendingSendRecipientIds);

        const sendOptions = await getSendOptionsForRecipients(
          pendingSendRecipientIds
        );

        log.info(
          `stories.sendStory(${messageId}): sending story to ${receiverId}`
        );

        const storyMessage = new Proto.StoryMessage();
        storyMessage.profileKey = originalStoryMessage.profileKey;
        storyMessage.fileAttachment = originalStoryMessage.fileAttachment;
        storyMessage.textAttachment = originalStoryMessage.textAttachment;
        storyMessage.group = originalStoryMessage.group;
        storyMessage.allowsReplies =
          isGroupV2(messageConversation.attributes) ||
          Boolean(distributionList?.allowsReplies);

        const sendTarget = distributionList
          ? {
              getGroupId: () => undefined,
              getMembers: () =>
                pendingSendRecipientIds
                  .map(uuid => window.ConversationController.get(uuid))
                  .filter(isNotNil),
              hasMember: (uuid: UUIDStringType) => recipientsSet.has(uuid),
              idForLogging: () => `dl(${receiverId})`,
              isGroupV2: () => true,
              isValid: () => true,
              getSenderKeyInfo: () => distributionList.senderKeyInfo,
              saveSenderKeyInfo: async (senderKeyInfo: SenderKeyInfoType) =>
                dataInterface.modifyStoryDistribution({
                  ...distributionList,
                  senderKeyInfo,
                }),
            }
          : conversation.toSenderKeyTarget();

        const contentMessage = new Proto.Content();
        contentMessage.storyMessage = storyMessage;

        const innerPromise = sendContentMessageToGroup({
          contentHint: ContentHint.IMPLICIT,
          contentMessage,
          isPartialSend: false,
          messageId: undefined,
          recipients: pendingSendRecipientIds,
          sendOptions,
          sendTarget,
          sendType: 'story',
          timestamp,
          urgent: false,
        });

        // Do not send sync messages for distribution lists since that's sent
        // in bulk at the end.
        message.doNotSendSyncMessage = Boolean(distributionList);

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
            if (!isSent(sendState.status)) {
              return;
            }

            sentConversationIds.set(recipientConversationId, sendState);

            const recipient = window.ConversationController.get(
              recipientConversationId
            );
            const uuid = recipient?.get('uuid');
            if (!uuid) {
              return;
            }
            sentUuids.add(uuid);
          }
        );

        allRecipientIds.forEach(uuid => {
          addDistributionListToUuidSent(
            listId,
            uuid,
            allowedReplyByUuid.get(uuid)
          );
        });

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
        isSyncMessageUpdate = sentRecipientIds.length > 0;
      }
    })
  );

  // Some contacts are duplicated across lists and we don't send duplicate
  // messages but we still want to make sure that the sendStateByConversationId
  // is kept in sync across all messages.
  await Promise.all(
    messageIds.map(async messageId => {
      const message = await getMessageById(messageId);
      if (!message) {
        return;
      }

      const oldSendStateByConversationId =
        message.get('sendStateByConversationId') || {};

      const newSendStateByConversationId = Object.keys(
        oldSendStateByConversationId
      ).reduce((acc, conversationId) => {
        const sendState = sentConversationIds.get(conversationId);
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
      return window.Signal.Data.saveMessage(message.attributes, {
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      });
    })
  );

  // Remove any unsent recipients
  recipientsByUuid.forEach((_value, uuid) => {
    if (sentUuids.has(uuid)) {
      return;
    }

    recipientsByUuid.delete(uuid);
  });

  // Build up the sync message's storyMessageRecipients and send it
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
  allRecipientIds: Array<string>;
  allowedReplyByUuid: Map<string, boolean>;
  pendingSendRecipientIds: Array<string>;
  sentRecipientIds: Array<string>;
  untrustedUuids: Array<string>;
} {
  const allRecipientIds: Array<string> = [];
  const allowedReplyByUuid = new Map<string, boolean>();
  const pendingSendRecipientIds: Array<string> = [];
  const sentRecipientIds: Array<string> = [];
  const untrustedUuids: Array<string> = [];

  Object.entries(message.get('sendStateByConversationId') || {}).forEach(
    ([recipientConversationId, sendState]) => {
      const recipient = window.ConversationController.get(
        recipientConversationId
      );
      if (!recipient) {
        return;
      }

      const isRecipientMe = isMe(recipient.attributes);
      if (isRecipientMe) {
        return;
      }

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

      const recipientSendTarget = recipient.getSendTarget();
      if (!recipientSendTarget) {
        return;
      }

      allowedReplyByUuid.set(
        recipientSendTarget,
        Boolean(sendState.isAllowedToReplyToStory)
      );
      allRecipientIds.push(recipientSendTarget);

      if (sendState.isAlreadyIncludedInAnotherDistributionList) {
        return;
      }

      if (isSent(sendState.status)) {
        sentRecipientIds.push(recipientSendTarget);
        return;
      }

      pendingSendRecipientIds.push(recipientSendTarget);
    }
  );

  return {
    allRecipientIds,
    allowedReplyByUuid,
    pendingSendRecipientIds,
    sentRecipientIds,
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
  return Object.values(sendStateByConversationId).every(
    sendState =>
      sendState.isAlreadyIncludedInAnotherDistributionList ||
      isSent(sendState.status)
  );
}
