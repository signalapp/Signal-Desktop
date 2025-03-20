// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { handleMessageSend } from '../../util/handleMessageSend';
import { getSendOptions } from '../../util/getSendOptions';
import { isDirectConversation } from '../../util/whatTypeOfConversation';
import { SignalService as Proto } from '../../protobuf';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors';

import type { ConversationModel } from '../../models/conversations';
import type {
  ConversationQueueJobBundle,
  NullMessageJobData,
} from '../conversationJobQueue';
import type { SessionResetsType } from '../../textsecure/Types.d';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import {
  OutgoingIdentityKeyError,
  UnregisteredUserError,
} from '../../textsecure/Errors';
import MessageSender from '../../textsecure/SendMessage';
import { sendToGroup } from '../../util/sendToGroup';

async function clearResetsTracking(idForTracking: string | undefined) {
  if (!idForTracking) {
    return;
  }

  const sessionResets = window.storage.get(
    'sessionResets',
    {} as SessionResetsType
  );
  delete sessionResets[idForTracking];
  await window.storage.put('sessionResets', sessionResets);
}

export async function sendNullMessage(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: NullMessageJobData
): Promise<void> {
  const { idForTracking } = data;

  if (!shouldContinue) {
    log.info('Ran out of time. Giving up on sending null message');
    await clearResetsTracking(idForTracking);
    return;
  }

  log.info(
    `starting null message send to ${conversation.idForLogging()} with timestamp ${timestamp}`
  );

  const sendOptions = await getSendOptions(conversation.attributes);
  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
  const contentHint = ContentHint.RESENDABLE;
  const sendType = 'nullMessage';

  // Note: we will send to blocked users, to those still in message request state, etc.
  //   Any needed blocking should still apply once the decryption error is fixed.

  try {
    const proto = MessageSender.getNullMessage();
    if (isDirectConversation(conversation.attributes)) {
      if (isConversationUnregistered(conversation.attributes)) {
        await clearResetsTracking(idForTracking);
        log.info(
          `conversation ${conversation.idForLogging()} is unregistered; refusing to send null message`
        );
        return;
      }

      await conversation.queueJob(
        'conversationQueue/sendNullMessage/direct',
        _abortSignal =>
          handleMessageSend(
            messaging.sendIndividualProto({
              contentHint,
              serviceId: conversation.getSendTarget(),
              options: sendOptions,
              proto,
              timestamp,
              urgent: false,
            }),
            {
              messageIds: [],
              sendType,
            }
          )
      );
    } else {
      const groupV2Info = conversation.getGroupV2Info();
      if (groupV2Info) {
        groupV2Info.revision = 0;
      }

      await conversation.queueJob(
        'conversationQueue/sendNullMessage/group',
        abortSignal =>
          sendToGroup({
            abortSignal,
            contentHint: ContentHint.RESENDABLE,
            groupSendOptions: {
              attachments: [],
              bodyRanges: [],
              contact: [],
              deletedForEveryoneTimestamp: undefined,
              expireTimer: undefined,
              groupV2: groupV2Info,
              messageText: undefined,
              preview: [],
              profileKey: undefined,
              quote: undefined,
              sticker: undefined,
              storyContext: undefined,
              reaction: undefined,
              targetTimestampForEdit: undefined,
              timestamp,
            },
            messageId: undefined,
            sendOptions,
            sendTarget: conversation.toSenderKeyTarget(),
            sendType,
            story: false,
            urgent: true,
          })
      );
    }
  } catch (error: unknown) {
    if (
      error instanceof OutgoingIdentityKeyError ||
      error instanceof UnregisteredUserError
    ) {
      log.info(
        'Send failure was OutgoingIdentityKeyError or UnregisteredUserError. Cancelling job.'
      );
      return;
    }

    if (isFinalAttempt) {
      await clearResetsTracking(idForTracking);
    }

    await handleMultipleSendErrors({
      errors: maybeExpandErrors(error),
      isFinalAttempt,
      log,
      timeRemaining,
      toThrow: error,
    });
  }
}
