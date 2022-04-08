// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { isNumber } from 'lodash';
import type { CallbackResultType } from '../textsecure/Types.d';
import dataInterface from '../sql/Client';
import * as log from '../logging/log';
import {
  OutgoingMessageError,
  SendMessageNetworkError,
  SendMessageProtoError,
  UnregisteredUserError,
} from '../textsecure/Errors';
import { SEALED_SENDER } from '../types/SealedSender';

const { insertSentProto, updateConversation } = dataInterface;

export const sendTypesEnum = z.enum([
  'blockSyncRequest',
  'pniIdentitySyncRequest',
  'callingMessage', // excluded from send log
  'configurationSyncRequest',
  'contactSyncRequest',
  'deleteForEveryone',
  'deliveryReceipt',
  'expirationTimerUpdate',
  'fetchLatestManifestSync',
  'fetchLocalProfileSync',
  'groupChange',
  'groupSyncRequest',
  'keySyncRequest',
  'legacyGroupChange',
  'message',
  'messageRequestSync',
  'nullMessage',
  'profileKeyUpdate',
  'reaction',
  'readReceipt',
  'readSync',
  'resendFromLog', // excluded from send log
  'resetSession',
  'retryRequest', // excluded from send log
  'senderKeyDistributionMessage',
  'sentSync',
  'stickerPackSync',
  'typing', // excluded from send log
  'verificationSync',
  'viewOnceSync',
  'viewSync',
  'viewedReceipt',
]);

export type SendTypesType = z.infer<typeof sendTypesEnum>;

export function shouldSaveProto(sendType: SendTypesType): boolean {
  if (sendType === 'callingMessage') {
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

function processError(error: unknown): void {
  if (
    error instanceof OutgoingMessageError ||
    error instanceof SendMessageNetworkError
  ) {
    const conversation = window.ConversationController.getOrCreate(
      error.identifier,
      'private'
    );
    if (error.code === 401 || error.code === 403) {
      if (
        conversation.get('sealedSender') === SEALED_SENDER.ENABLED ||
        conversation.get('sealedSender') === SEALED_SENDER.UNRESTRICTED
      ) {
        log.warn(
          `handleMessageSend: Got 401/403 for ${conversation.idForLogging()}, removing profile key`
        );

        conversation.setProfileKey(undefined);
      }
      if (conversation.get('sealedSender') === SEALED_SENDER.UNKNOWN) {
        log.warn(
          `handleMessageSend: Got 401/403 for ${conversation.idForLogging()}, setting sealedSender = DISABLED`
        );
        conversation.set('sealedSender', SEALED_SENDER.DISABLED);
        updateConversation(conversation.attributes);
      }
    }
    if (error.code === 404) {
      log.warn(
        `handleMessageSend: Got 404 for ${conversation.idForLogging()}, marking unregistered.`
      );
      conversation.setUnregistered();
    }
  }
  if (error instanceof UnregisteredUserError) {
    const conversation = window.ConversationController.getOrCreate(
      error.identifier,
      'private'
    );
    log.warn(
      `handleMessageSend: Got 404 for ${conversation.idForLogging()}, marking unregistered.`
    );
    conversation.setUnregistered();
  }
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
    processError(err);

    if (err instanceof SendMessageProtoError) {
      await handleMessageSendResult(
        err.failoverIdentifiers,
        err.unidentifiedDeliveries
      );

      err.errors?.forEach(processError);
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
