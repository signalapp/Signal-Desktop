// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';

import { SendMessageProtoError } from '../textsecure/Errors';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';

import type { CallbackResultType } from '../textsecure/Types.d';
import type { ConversationModel } from '../models/conversations';
import type { SendTypesType } from './handleMessageSend';
import type MessageSender from '../textsecure/SendMessage';
import { areAllErrorsUnregistered } from '../jobs/helpers/areAllErrorsUnregistered';

export async function wrapWithSyncMessageSend({
  conversation,
  logId: parentLogId,
  messageIds,
  send,
  sendType,
  timestamp,
}: {
  conversation: ConversationModel;
  logId: string;
  messageIds: Array<string>;
  send: (sender: MessageSender) => Promise<CallbackResultType>;
  sendType: SendTypesType;
  timestamp: number;
}): Promise<void> {
  const logId = `wrapWithSyncMessageSend(${parentLogId}, ${timestamp})`;
  const sender = window.textsecure.messaging;
  if (!sender) {
    throw new Error(`${logId}: textsecure.messaging is not available!`);
  }

  let response: CallbackResultType | undefined;
  let error: Error | undefined;
  let didSuccessfullySendOne = false;

  try {
    response = await handleMessageSend(send(sender), { messageIds, sendType });
    didSuccessfullySendOne = true;
  } catch (thrown) {
    if (thrown instanceof SendMessageProtoError) {
      didSuccessfullySendOne = Boolean(
        thrown.successfulServiceIds && thrown.successfulServiceIds.length > 0
      );
      error = thrown;
    }
    if (thrown instanceof Error) {
      error = thrown;
    } else {
      log.error(`${logId}: Thrown value was not an Error, returning early`);
      throw error;
    }
  }

  if (!response && !error) {
    throw new Error(`${logId}: message send didn't return result or error!`);
  }

  const dataMessage =
    response?.dataMessage ||
    (error instanceof SendMessageProtoError ? error.dataMessage : undefined);

  if (didSuccessfullySendOne) {
    if (!dataMessage) {
      log.error(`${logId}: dataMessage was not returned by send!`);
    } else {
      log.info(`${logId}: Sending sync message... `);
      const ourConversation =
        window.ConversationController.getOurConversationOrThrow();
      const options = await getSendOptions(ourConversation.attributes, {
        syncMessage: true,
      });
      await handleMessageSend(
        sender.sendSyncMessage({
          destinationE164: conversation.get('e164'),
          destinationServiceId: conversation.getServiceId(),
          encodedDataMessage: dataMessage,
          expirationStartTimestamp: null,
          options,
          timestamp,
          urgent: false,
        }),
        { messageIds, sendType: sendType === 'message' ? 'sentSync' : sendType }
      );
    }
  }

  if (error instanceof Error) {
    if (areAllErrorsUnregistered(conversation.attributes, error)) {
      log.info(
        `${logId}: Group send failures were all UnregisteredUserError, ` +
          'returning successfully.'
      );
      return;
    }

    throw error;
  }
}
