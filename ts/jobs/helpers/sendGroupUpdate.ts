// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getSendOptionsForRecipients } from '../../util/getSendOptions';
import { isGroupV2 } from '../../util/whatTypeOfConversation';
import { SignalService as Proto } from '../../protobuf';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend';
import * as Bytes from '../../Bytes';
import { strictAssert } from '../../util/assert';
import { ourProfileKeyService } from '../../services/ourProfileKey';

import type { ConversationModel } from '../../models/conversations';
import type { GroupV2InfoType } from '../../textsecure/SendMessage';
import type {
  GroupUpdateJobData,
  ConversationQueueJobBundle,
} from '../conversationJobQueue';
import { getUntrustedConversationUuids } from './getUntrustedConversationUuids';

// Note: because we don't have a recipient map, if some sends fail, we will resend this
//   message to folks that got it on the first go-round. This is okay, because receivers
//   will drop this as an empty message if they already know about its revision.
export async function sendGroupUpdate(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    shouldContinue,
    timeRemaining,
    timestamp,
    log,
  }: ConversationQueueJobBundle,
  data: GroupUpdateJobData
): Promise<void> {
  if (!shouldContinue) {
    log.info('Ran out of time. Giving up on sending group update');
    return;
  }

  if (!isGroupV2(conversation.attributes)) {
    log.error(
      `Conversation ${conversation.idForLogging()} is not GroupV2, cannot send group update!`
    );
    return;
  }

  log.info(
    `Starting group update for ${conversation.idForLogging()} with timestamp ${timestamp}`
  );

  const { groupChangeBase64, recipients, revision } = data;

  const untrustedUuids = getUntrustedConversationUuids(recipients);
  if (untrustedUuids.length) {
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: conversation.id,
      untrustedUuids,
    });
    throw new Error(
      `Group update blocked because ${untrustedUuids.length} conversation(s) were untrusted. Failing this attempt.`
    );
  }

  const sendOptions = await getSendOptionsForRecipients(recipients);

  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
  const contentHint = ContentHint.RESENDABLE;
  const sendType = 'groupChange';
  const logId = `sendGroupUpdate/${conversation.idForLogging()}`;

  const groupChange = groupChangeBase64
    ? Bytes.fromBase64(groupChangeBase64)
    : undefined;

  let profileKey: Uint8Array | undefined;
  if (conversation.get('profileSharing')) {
    profileKey = await ourProfileKeyService.get();
  }

  const groupV2Info = conversation.getGroupV2Info();
  strictAssert(groupV2Info, 'groupV2Info missing');
  const groupV2: GroupV2InfoType = {
    ...groupV2Info,
    revision,
    members: recipients,
    groupChange,
  };

  try {
    await conversation.queueJob(
      'conversationQueue/sendGroupUpdate',
      async abortSignal =>
        wrapWithSyncMessageSend({
          conversation,
          logId,
          messageIds: [],
          send: async () =>
            window.Signal.Util.sendToGroup({
              abortSignal,
              groupSendOptions: {
                groupV2,
                timestamp,
                profileKey,
              },
              contentHint,
              messageId: undefined,
              sendOptions,
              sendTarget: conversation.toSenderKeyTarget(),
              sendType,
              urgent: false,
            }),
          sendType,
          timestamp,
        })
    );
  } catch (error: unknown) {
    await handleMultipleSendErrors({
      errors: maybeExpandErrors(error),
      isFinalAttempt,
      log,
      timeRemaining,
      toThrow: error,
    });
  }
}
