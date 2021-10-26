// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';
import type { CallbackResultType } from '../textsecure/Types.d';
import dataInterface from '../sql/Client';
import * as log from '../logging/log';

const { insertSentProto } = dataInterface;

export const SEALED_SENDER = {
  UNKNOWN: 0,
  ENABLED: 1,
  DISABLED: 2,
  UNRESTRICTED: 3,
};

export type SendTypesType =
  | 'callingMessage' // excluded from send log
  | 'deleteForEveryone'
  | 'deliveryReceipt'
  | 'expirationTimerUpdate'
  | 'groupChange'
  | 'legacyGroupChange'
  | 'message'
  | 'nullMessage' // excluded from send log
  | 'otherSync'
  | 'profileKeyUpdate'
  | 'reaction'
  | 'readReceipt'
  | 'readSync'
  | 'resendFromLog' // excluded from send log
  | 'resetSession'
  | 'retryRequest' // excluded from send log
  | 'senderKeyDistributionMessage'
  | 'sentSync'
  | 'typing' // excluded from send log
  | 'verificationSync'
  | 'viewOnceSync'
  | 'viewSync'
  | 'viewedReceipt';

export function shouldSaveProto(sendType: SendTypesType): boolean {
  if (sendType === 'callingMessage') {
    return false;
  }

  if (sendType === 'nullMessage') {
    return false;
  }

  if (sendType === 'resendFromLog') {
    return false;
  }

  if (sendType === 'retryRequest') {
    return false;
  }

  if (sendType === 'typing') {
    return false;
  }

  return true;
}

export async function handleMessageSend(
  promise: Promise<CallbackResultType>,
  options: {
    messageIds: Array<string>;
    sendType: SendTypesType;
  }
): Promise<CallbackResultType> {
  try {
    const result = await promise;

    await maybeSaveToSendLog(result, options);

    await handleMessageSendResult(
      result.failoverIdentifiers,
      result.unidentifiedDeliveries
    );

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
        log.info(
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
          log.info(
            `Setting sealedSender to ENABLED for conversation ${conversation.idForLogging()}`
          );
          conversation.set({
            sealedSender: SEALED_SENDER.ENABLED,
          });
        } else {
          log.info(
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

async function maybeSaveToSendLog(
  result: CallbackResultType,
  {
    messageIds,
    sendType,
  }: {
    messageIds: Array<string>;
    sendType: SendTypesType;
  }
): Promise<void> {
  const { contentHint, contentProto, recipients, timestamp } = result;

  if (!shouldSaveProto(sendType)) {
    return;
  }

  if (!isNumber(contentHint) || !contentProto || !recipients || !timestamp) {
    log.warn(
      `handleMessageSend: Missing necessary information to save to log for ${sendType} message ${timestamp}`
    );
    return;
  }

  const identifiers = Object.keys(recipients);
  if (identifiers.length === 0) {
    log.warn(
      `handleMessageSend: ${sendType} message ${timestamp} had no recipients`
    );
    return;
  }

  // If the identifier count is greater than one, we've done the save elsewhere
  if (identifiers.length > 1) {
    return;
  }

  await insertSentProto(
    {
      timestamp,
      proto: Buffer.from(contentProto),
      contentHint,
    },
    {
      messageIds,
      recipients,
    }
  );
}
