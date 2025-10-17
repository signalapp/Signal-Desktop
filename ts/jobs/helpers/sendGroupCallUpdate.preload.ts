// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';

import { getSendOptions } from '../../util/getSendOptions.preload.js';
import { isGroup } from '../../util/whatTypeOfConversation.dom.js';
import {
  handleMultipleSendErrors,
  maybeExpandErrors,
} from './handleMultipleSendErrors.std.js';

import type { ConversationModel } from '../../models/conversations.preload.js';
import type {
  ConversationQueueJobBundle,
  GroupCallUpdateJobData,
} from '../conversationJobQueue.preload.js';
import { getUntrustedConversationServiceIds } from './getUntrustedConversationServiceIds.dom.js';
import { sendToGroup } from '../../util/sendToGroup.preload.js';
import { wrapWithSyncMessageSend } from '../../util/wrapWithSyncMessageSend.preload.js';
import { getValidRecipients } from './getValidRecipients.dom.js';

export async function sendGroupCallUpdate(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    shouldContinue,
    timestamp,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: GroupCallUpdateJobData
): Promise<void> {
  const { eraId, urgent } = data;
  const logId = `sendCallUpdate(${conversation.idForLogging()}.${eraId})`;
  if (!shouldContinue) {
    log.info(`${logId}: Ran out of time. Giving up.`);
    return;
  }

  log.info(`${logId}: Starting send`);

  if (!isGroup(conversation.attributes)) {
    log.warn(`${logId}: Conversation is not a group; refusing to send`);
    return;
  }

  const recipients = getValidRecipients(conversation.getRecipients(), {
    log,
    logId,
  });

  const untrustedServiceIds = getUntrustedConversationServiceIds(recipients);
  if (untrustedServiceIds.length) {
    window.reduxActions.conversations.conversationStoppedByMissingVerification({
      conversationId: conversation.id,
      untrustedServiceIds,
    });
    throw new Error(
      `${logId}: Blocked because ${untrustedServiceIds.length} conversation(s) were untrusted. Failing this attempt.`
    );
  }

  if (recipients.length === 0) {
    log.warn(`${logId}: Giving up because there are no valid recipients.`);
    return;
  }

  const sendType = 'callingMessage';
  const groupV2 = conversation.getGroupV2Info();
  const sendOptions = await getSendOptions(conversation.attributes);
  if (!groupV2) {
    log.error(`${logId}: Conversation lacks groupV2 info!`);
    return;
  }

  try {
    await wrapWithSyncMessageSend({
      conversation,
      logId,
      messageIds: [],
      send: () =>
        conversation.queueJob(logId, () =>
          sendToGroup({
            contentHint: ContentHint.Default,
            groupSendOptions: {
              groupCallUpdate: { eraId },
              groupV2,
              timestamp,
            },
            messageId: undefined,
            sendOptions,
            sendTarget: conversation.toSenderKeyTarget(),
            sendType,
            urgent,
          })
        ),
      sendType,
      timestamp,
    });
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
