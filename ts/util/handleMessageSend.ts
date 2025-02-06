// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { isBoolean, isNumber } from 'lodash';
import type { CallbackResultType } from '../textsecure/Types.d';
import { DataWriter } from '../sql/Client';
import * as log from '../logging/log';
import {
  OutgoingMessageError,
  SendMessageNetworkError,
  SendMessageProtoError,
  UnregisteredUserError,
} from '../textsecure/Errors';
import { SEALED_SENDER } from '../types/SealedSender';
import type { ServiceIdString } from '../types/ServiceId';
import { drop } from './drop';

const { insertSentProto, updateConversation } = DataWriter;

export const sendTypesEnum = z.enum([
  // Core user interactions, default urgent
  'message',
  'story', // non-urgent
  'callingMessage', // excluded from send log; only call-initiation messages are urgent
  'deleteForEveryone',
  'expirationTimerUpdate', // non-urgent
  'groupChange', // non-urgent
  'reaction',
  'typing', // excluded from send log; non-urgent

  // Responding to incoming messages, all non-urgent
  'deliveryReceipt',
  'readReceipt',
  'viewedReceipt',

  // Encryption housekeeping, default non-urgent
  'nullMessage',
  'profileKeyUpdate',
  'resendFromLog', // excluded from send log, only urgent if original message was urgent
  'retryRequest', // excluded from send log
  'senderKeyDistributionMessage', // only urgent if associated message is

  // Sync messages sent during link, default non-urgent
  'blockSyncRequest',
  'configurationSyncRequest',
  'contactSyncRequest', // urgent because it blocks the link process
  'keySyncRequest', // urgent because it blocks the link process
  'pniIdentitySyncRequest', // urgent because we need our PNI to be fully functional

  // The actual sync messages, which we never send, just receive - non-urgent
  'configurationSync',
  'contactSync',
  'keySync',
  'pniIdentitySync',

  // Syncs, default non-urgent
  'blockSync',
  'deleteForMeSync',
  'fetchLatestManifestSync',
  'fetchLocalProfileSync',
  'messageRequestSync',
  'readSync', // urgent
  'sentSync',
  'stickerPackSync',
  'verificationSync',
  'viewOnceSync',
  'viewSync',
  'callEventSync',
  'callLinkUpdateSync',
  'callLogEventSync',
  'deviceNameChangeSync',

  // No longer used, all non-urgent
  'legacyGroupChange',
  'resetSession',
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
      if (conversation.get('sealedSender') !== SEALED_SENDER.DISABLED) {
        log.warn(
          `handleMessageSend: Got 401/403 for ${conversation.idForLogging()}, setting sealedSender = DISABLED`
        );
        conversation.set('sealedSender', SEALED_SENDER.DISABLED);
        drop(updateConversation(conversation.attributes));
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
      error.serviceId,
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
      result.failoverServiceIds,
      result.unidentifiedDeliveries
    );

    return result;
  } catch (err) {
    processError(err);

    if (err instanceof SendMessageProtoError) {
      await handleMessageSendResult(
        err.failoverServiceIds,
        err.unidentifiedDeliveries
      );

      err.errors?.forEach(processError);
    }

    throw err;
  }
}

async function handleMessageSendResult(
  failoverServiceIds: Array<ServiceIdString> | undefined,
  unidentifiedDeliveries: Array<ServiceIdString> | undefined
): Promise<void> {
  await Promise.all(
    (failoverServiceIds || []).map(async serviceId => {
      const conversation = window.ConversationController.get(serviceId);

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
        await DataWriter.updateConversation(conversation.attributes);
      }
    })
  );

  await Promise.all(
    (unidentifiedDeliveries || []).map(async serviceId => {
      const conversation = window.ConversationController.get(serviceId);

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
        await DataWriter.updateConversation(conversation.attributes);
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
  const {
    contentHint,
    contentProto,
    recipients,
    timestamp,
    urgent,
    hasPniSignatureMessage,
  } = result;

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
      urgent: isBoolean(urgent) ? urgent : true,
      hasPniSignatureMessage: Boolean(hasPniSignatureMessage),
    },
    {
      messageIds,
      recipients,
    }
  );
}
