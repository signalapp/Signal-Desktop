// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallbackResultType } from '../textsecure/SendMessage';

const SEALED_SENDER = {
  UNKNOWN: 0,
  ENABLED: 1,
  DISABLED: 2,
  UNRESTRICTED: 3,
};

export async function handleMessageSend(
  promise: Promise<CallbackResultType | void | null>
): Promise<CallbackResultType | void | null> {
  try {
    const result = await promise;
    if (result) {
      await handleMessageSendResult(
        result.failoverIdentifiers,
        result.unidentifiedDeliveries
      );
    }
    return result;
  } catch (err) {
    if (err) {
      await handleMessageSendResult(
        err.failoverIdentifiers,
        err.unidentifiedDeliveries
      );
    }
    throw err;
  }
}

async function handleMessageSendResult(
  failoverIdentifiers: Array<string> | undefined,
  unidentifiedDeliveries: Array<string> | undefined
): Promise<void> {
  await Promise.all(
    (failoverIdentifiers || []).map(async identifier => {
      const conversation = window.ConversationController.get(identifier);

      if (
        conversation &&
        conversation.get('sealedSender') !== SEALED_SENDER.DISABLED
      ) {
        window.log.info(
          `Setting sealedSender to DISABLED for conversation ${conversation.idForLogging()}`
        );
        conversation.set({
          sealedSender: SEALED_SENDER.DISABLED,
        });
        window.Signal.Data.updateConversation(conversation.attributes);
      }
    })
  );

  await Promise.all(
    (unidentifiedDeliveries || []).map(async identifier => {
      const conversation = window.ConversationController.get(identifier);

      if (
        conversation &&
        conversation.get('sealedSender') === SEALED_SENDER.UNKNOWN
      ) {
        if (conversation.get('accessKey')) {
          window.log.info(
            `Setting sealedSender to ENABLED for conversation ${conversation.idForLogging()}`
          );
          conversation.set({
            sealedSender: SEALED_SENDER.ENABLED,
          });
        } else {
          window.log.info(
            `Setting sealedSender to UNRESTRICTED for conversation ${conversation.idForLogging()}`
          );
          conversation.set({
            sealedSender: SEALED_SENDER.UNRESTRICTED,
          });
        }
        window.Signal.Data.updateConversation(conversation.attributes);
      }
    })
  );
}
