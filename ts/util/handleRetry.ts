// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  DecryptionErrorMessage,
  PlaintextContent,
} from '@signalapp/libsignal-client';
import { isBoolean, isNumber } from 'lodash';

import * as Bytes from '../Bytes';
import { isProduction } from './version';
import { strictAssert } from './assert';
import { getSendOptions } from './getSendOptions';
import { handleMessageSend } from './handleMessageSend';
import { isGroupV2 } from './whatTypeOfConversation';
import { isOlderThan } from './timestamp';
import { parseIntOrThrow } from './parseIntOrThrow';
import * as RemoteConfig from '../RemoteConfig';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { UUID } from '../types/UUID';
import { ToastDecryptionError } from '../components/ToastDecryptionError';
import { showToast } from './showToast';
import * as Errors from '../types/errors';

import type { ConversationModel } from '../models/conversations';
import type {
  DecryptionErrorEvent,
  DecryptionErrorEventData,
  RetryRequestEvent,
  RetryRequestEventData,
} from '../textsecure/messageReceiverEvents';

import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import MessageSender from '../textsecure/SendMessage';

const RETRY_LIMIT = 5;

// Note: Neither of the the two functions onRetryRequest and onDecrytionError use a job
//   queue to make sure sends are reliable. That's unnecessary because these tasks are
//   tied to incoming message processing queue, and will only confirm() completion on
//   successful send.

// Entrypoints

const retryRecord = new Map<number, number>();

export function _getRetryRecord(): Map<number, number> {
  return retryRecord;
}

export async function onRetryRequest(event: RetryRequestEvent): Promise<void> {
  const { confirm, retryRequest } = event;
  const {
    groupId: requestGroupId,
    requesterDevice,
    requesterUuid,
    senderDevice,
    sentAt,
  } = retryRequest;
  const logId = `${requesterUuid}.${requesterDevice} ${sentAt}.${senderDevice}`;

  log.info(`onRetryRequest/${logId}: Starting...`);

  if (!RemoteConfig.isEnabled('desktop.senderKey.retry')) {
    log.warn(
      `onRetryRequest/${logId}: Feature flag disabled, returning early.`
    );
    confirm();
    return;
  }

  const retryCount = (retryRecord.get(sentAt) || 0) + 1;
  retryRecord.set(sentAt, retryCount);
  if (retryCount > RETRY_LIMIT) {
    log.warn(
      `onRetryRequest/${logId}: retryCount is ${retryCount}; returning early.`
    );
    confirm();
    return;
  }

  if (window.RETRY_DELAY) {
    log.warn(`onRetryRequest/${logId}: Delaying because RETRY_DELAY is set...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  let retryRespondMaxAge = 14 * DAY;
  try {
    retryRespondMaxAge = parseIntOrThrow(
      RemoteConfig.getValue('desktop.retryRespondMaxAge'),
      'retryRespondMaxAge'
    );
  } catch (error) {
    log.warn(
      `onRetryRequest/${logId}: Failed to parse integer from desktop.retryRespondMaxAge feature flag`,
      error && error.stack ? error.stack : error
    );
  }

  const didArchive = await archiveSessionOnMatch(retryRequest);

  if (isOlderThan(sentAt, retryRespondMaxAge)) {
    log.info(
      `onRetryRequest/${logId}: Message is too old, refusing to send again.`
    );
    await sendDistributionMessageOrNullMessage(logId, retryRequest, didArchive);
    confirm();
    return;
  }

  const sentProto = await window.Signal.Data.getSentProtoByRecipient({
    now: Date.now(),
    recipientUuid: requesterUuid,
    timestamp: sentAt,
  });

  if (!sentProto) {
    log.info(`onRetryRequest/${logId}: Did not find sent proto`);
    await sendDistributionMessageOrNullMessage(logId, retryRequest, didArchive);
    confirm();
    return;
  }

  log.info(`onRetryRequest/${logId}: Resending message`);

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error(`onRetryRequest/${logId}: messaging is not available!`);
  }

  const { contentHint, messageIds, proto, timestamp, urgent } = sentProto;

  const { contentProto, groupId } = await maybeAddSenderKeyDistributionMessage({
    contentProto: Proto.Content.decode(proto),
    logId,
    messageIds,
    requestGroupId,
    requesterUuid,
    timestamp,
  });

  const recipientConversation = window.ConversationController.getOrCreate(
    requesterUuid,
    'private'
  );
  const sendOptions = await getSendOptions(recipientConversation.attributes);
  const promise = messaging.sendMessageProtoAndWait({
    contentHint,
    groupId,
    options: sendOptions,
    proto: new Proto.Content(contentProto),
    recipients: [requesterUuid],
    timestamp,
    urgent,
  });

  await handleMessageSend(promise, {
    messageIds: [],
    sendType: 'resendFromLog',
  });

  confirm();
  log.info(`onRetryRequest/${logId}: Resend complete.`);
}

function maybeShowDecryptionToast(
  logId: string,
  name: string,
  deviceId: number
) {
  if (isProduction(window.getVersion())) {
    return;
  }

  log.info(`maybeShowDecryptionToast/${logId}: Showing decryption error toast`);
  showToast(ToastDecryptionError, {
    deviceId,
    name,
    onShowDebugLog: () => window.showDebugLog(),
  });
}

export async function onDecryptionError(
  event: DecryptionErrorEvent
): Promise<void> {
  const { confirm, decryptionError } = event;
  const { senderUuid, senderDevice, timestamp } = decryptionError;
  const logId = `${senderUuid}.${senderDevice} ${timestamp}`;

  log.info(`onDecryptionError/${logId}: Starting...`);

  const retryCount = (retryRecord.get(timestamp) || 0) + 1;
  retryRecord.set(timestamp, retryCount);
  if (retryCount > RETRY_LIMIT) {
    log.warn(
      `onDecryptionError/${logId}: retryCount is ${retryCount}; returning early.`
    );
    confirm();
    return;
  }

  const conversation = window.ConversationController.getOrCreate(
    senderUuid,
    'private'
  );
  if (!conversation.get('capabilities')?.senderKey) {
    await conversation.getProfiles();
  }

  const name = conversation.getTitle();
  maybeShowDecryptionToast(logId, name, senderDevice);

  if (
    conversation.get('capabilities')?.senderKey &&
    RemoteConfig.isEnabled('desktop.senderKey.retry')
  ) {
    await requestResend(decryptionError);
  } else {
    await startAutomaticSessionReset(decryptionError);
  }

  confirm();
  log.info(`onDecryptionError/${logId}: ...complete`);
}

// Helpers

async function archiveSessionOnMatch({
  ratchetKey,
  requesterUuid,
  requesterDevice,
  senderDevice,
}: RetryRequestEventData): Promise<boolean> {
  const ourDeviceId = parseIntOrThrow(
    window.textsecure.storage.user.getDeviceId(),
    'archiveSessionOnMatch/getDeviceId'
  );
  if (ourDeviceId !== senderDevice || !ratchetKey) {
    return false;
  }

  const ourUuid = window.textsecure.storage.user.getCheckedUuid();
  const address = new QualifiedAddress(
    ourUuid,
    Address.create(requesterUuid, requesterDevice)
  );
  const session = await window.textsecure.storage.protocol.loadSession(address);

  if (session && session.currentRatchetKeyMatches(ratchetKey)) {
    log.info(
      'archiveSessionOnMatch: Matching device and ratchetKey, archiving session'
    );
    await window.textsecure.storage.protocol.archiveSession(address);
    return true;
  }

  return false;
}

async function sendDistributionMessageOrNullMessage(
  logId: string,
  options: RetryRequestEventData,
  didArchive: boolean
): Promise<void> {
  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
  const { groupId, requesterUuid } = options;
  let sentDistributionMessage = false;
  log.info(`sendDistributionMessageOrNullMessage/${logId}: Starting...`);

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error(
      `sendDistributionMessageOrNullMessage/${logId}: messaging is not available!`
    );
  }

  const conversation = window.ConversationController.getOrCreate(
    requesterUuid,
    'private'
  );
  const sendOptions = await getSendOptions(conversation.attributes);

  if (groupId) {
    const group = window.ConversationController.get(groupId);
    const distributionId = group?.get('senderKeyInfo')?.distributionId;

    if (group && !group.hasMember(new UUID(requesterUuid))) {
      throw new Error(
        `sendDistributionMessageOrNullMessage/${logId}: Requester ${requesterUuid} is not a member of ${conversation.idForLogging()}`
      );
    }

    if (group && distributionId) {
      log.info(
        `sendDistributionMessageOrNullMessage/${logId}: Found matching group, sending sender key distribution message`
      );

      try {
        await handleMessageSend(
          messaging.sendSenderKeyDistributionMessage(
            {
              contentHint: ContentHint.RESENDABLE,
              distributionId,
              groupId,
              identifiers: [requesterUuid],
              throwIfNotInDatabase: true,
              urgent: false,
            },
            sendOptions
          ),
          { messageIds: [], sendType: 'senderKeyDistributionMessage' }
        );
        sentDistributionMessage = true;
      } catch (error) {
        log.error(
          `sendDistributionMessageOrNullMessage/${logId}: Failed to send sender key distribution message`,
          error && error.stack ? error.stack : error
        );
      }
    }
  }

  if (!sentDistributionMessage) {
    if (!didArchive) {
      log.info(
        `sendDistributionMessageOrNullMessage/${logId}: Did't send distribution message and didn't archive session. Returning early.`
      );
      return;
    }

    log.info(
      `sendDistributionMessageOrNullMessage/${logId}: Did not send distribution message, sending null message`
    );

    // Enqueue a null message using the newly-created session
    try {
      const nullMessage = MessageSender.getNullMessage({
        uuid: requesterUuid,
      });
      await handleMessageSend(
        messaging.sendIndividualProto({
          ...nullMessage,
          options: sendOptions,
          proto: Proto.Content.decode(
            Bytes.fromBase64(nullMessage.protoBase64)
          ),
          timestamp: Date.now(),
          urgent: isBoolean(nullMessage.urgent) ? nullMessage.urgent : true,
        }),
        { messageIds: [], sendType: nullMessage.type }
      );
    } catch (error) {
      log.error(
        'sendDistributionMessageOrNullMessage: Failed to send null message',
        Errors.toLogFormat(error)
      );
    }
  }
}

async function getRetryConversation({
  logId,
  messageIds,
  requestGroupId,
}: {
  logId: string;
  messageIds: Array<string>;
  requestGroupId?: string;
}): Promise<ConversationModel | undefined> {
  if (messageIds.length !== 1) {
    // Fail over to requested groupId
    return window.ConversationController.get(requestGroupId);
  }

  const [messageId] = messageIds;
  const message = await window.Signal.Data.getMessageById(messageId);
  if (!message) {
    log.warn(
      `getRetryConversation/${logId}: Unable to find message ${messageId}`
    );
    // Fail over to requested groupId
    return window.ConversationController.get(requestGroupId);
  }

  const { conversationId } = message;
  return window.ConversationController.get(conversationId);
}

async function maybeAddSenderKeyDistributionMessage({
  contentProto,
  logId,
  messageIds,
  requestGroupId,
  requesterUuid,
  timestamp,
}: {
  contentProto: Proto.IContent;
  logId: string;
  messageIds: Array<string>;
  requestGroupId?: string;
  requesterUuid: string;
  timestamp: number;
}): Promise<{
  contentProto: Proto.IContent;
  groupId?: string;
}> {
  const conversation = await getRetryConversation({
    logId,
    messageIds,
    requestGroupId,
  });

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error(
      `maybeAddSenderKeyDistributionMessage/${logId}: messaging is not available!`
    );
  }

  if (!conversation) {
    log.warn(
      `maybeAddSenderKeyDistributionMessage/${logId}: Unable to find conversation`
    );
    return {
      contentProto,
    };
  }

  if (!conversation.hasMember(new UUID(requesterUuid))) {
    throw new Error(
      `maybeAddSenderKeyDistributionMessage/${logId}: Recipient ${requesterUuid} is not a member of ${conversation.idForLogging()}`
    );
  }

  if (!isGroupV2(conversation.attributes)) {
    return {
      contentProto,
    };
  }

  const senderKeyInfo = conversation.get('senderKeyInfo');
  if (senderKeyInfo && senderKeyInfo.distributionId) {
    const protoWithDistributionMessage =
      await messaging.getSenderKeyDistributionMessage(
        senderKeyInfo.distributionId,
        { throwIfNotInDatabase: true, timestamp }
      );

    return {
      contentProto: {
        ...contentProto,
        senderKeyDistributionMessage:
          protoWithDistributionMessage.senderKeyDistributionMessage,
      },
      groupId: conversation.get('groupId'),
    };
  }

  return {
    contentProto,
    groupId: conversation.get('groupId'),
  };
}

async function requestResend(decryptionError: DecryptionErrorEventData) {
  const {
    cipherTextBytes,
    cipherTextType,
    contentHint,
    groupId,
    receivedAtCounter,
    receivedAtDate,
    senderDevice,
    senderUuid,
    timestamp,
  } = decryptionError;
  const logId = `${senderUuid}.${senderDevice} ${timestamp}`;

  log.info(`requestResend/${logId}: Starting...`, {
    cipherTextBytesLength: cipherTextBytes?.byteLength,
    cipherTextType,
    contentHint,
    groupId: groupId ? `groupv2(${groupId})` : undefined,
  });

  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error(`requestResend/${logId}: messaging is not available!`);
  }

  // 1. Find the target conversation

  const group = groupId
    ? window.ConversationController.get(groupId)
    : undefined;
  const sender = window.ConversationController.getOrCreate(
    senderUuid,
    'private'
  );
  const conversation = group || sender;

  // 2. Send resend request

  if (!cipherTextBytes || !isNumber(cipherTextType)) {
    log.warn(
      `requestResend/${logId}: Missing cipherText information, failing over to automatic reset`
    );
    startAutomaticSessionReset(decryptionError);
    return;
  }

  try {
    const message = DecryptionErrorMessage.forOriginal(
      Buffer.from(cipherTextBytes),
      cipherTextType,
      timestamp,
      senderDevice
    );

    const plaintext = PlaintextContent.from(message);
    const options = await getSendOptions(conversation.attributes);
    const result = await handleMessageSend(
      messaging.sendRetryRequest({
        plaintext,
        options,
        groupId,
        uuid: senderUuid,
      }),
      { messageIds: [], sendType: 'retryRequest' }
    );
    if (result && result.errors && result.errors.length > 0) {
      throw result.errors[0];
    }
  } catch (error) {
    log.error(
      `requestResend/${logId}: Failed to send retry request, failing over to automatic reset`,
      error && error.stack ? error.stack : error
    );
    startAutomaticSessionReset(decryptionError);
    return;
  }

  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

  // 3. Determine how to represent this to the user. Three different options.

  // We believe that it could be successfully re-sent, so we'll add a placeholder.
  if (contentHint === ContentHint.RESENDABLE) {
    const { retryPlaceholders } = window.Signal.Services;
    strictAssert(retryPlaceholders, 'requestResend: adding placeholder');

    log.info(`requestResend/${logId}: Adding placeholder`);

    const state = window.reduxStore.getState();
    const selectedId = state.conversations.selectedConversationId;
    const wasOpened = selectedId === conversation.id;

    await retryPlaceholders.add({
      conversationId: conversation.get('id'),
      receivedAt: receivedAtDate,
      receivedAtCounter,
      sentAt: timestamp,
      senderUuid,
      wasOpened,
    });

    return;
  }

  // This message cannot be resent. We'll show no error and trust the other side to
  //   reset their session.
  if (contentHint === ContentHint.IMPLICIT) {
    log.info(`requestResend/${logId}: contentHint is IMPLICIT, doing nothing.`);
    return;
  }

  log.warn(`requestResend/${logId}: No content hint, adding error immediately`);
  conversation.queueJob('addDeliveryIssue', async () => {
    conversation.addDeliveryIssue({
      receivedAt: receivedAtDate,
      receivedAtCounter,
      senderUuid,
      sentAt: timestamp,
    });
  });
}

function scheduleSessionReset(senderUuid: string, senderDevice: number) {
  // Postpone sending light session resets until the queue is empty
  const { lightSessionResetQueue } = window.Signal.Services;

  if (!lightSessionResetQueue) {
    throw new Error(
      'scheduleSessionReset: lightSessionResetQueue is not available!'
    );
  }

  lightSessionResetQueue.add(async () => {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid();

    await window.textsecure.storage.protocol.lightSessionReset(
      new QualifiedAddress(ourUuid, Address.create(senderUuid, senderDevice))
    );
  });
}

function startAutomaticSessionReset(decryptionError: DecryptionErrorEventData) {
  const { senderUuid, senderDevice, timestamp } = decryptionError;
  const logId = `${senderUuid}.${senderDevice} ${timestamp}`;

  log.info(`startAutomaticSessionReset/${logId}: Starting...`);

  scheduleSessionReset(senderUuid, senderDevice);

  const conversation = window.ConversationController.lookupOrCreate({
    uuid: senderUuid,
  });
  if (!conversation) {
    log.warn(
      'onLightSessionReset: No conversation, cannot add message to timeline'
    );
    return;
  }

  const receivedAt = Date.now();
  const receivedAtCounter = window.Signal.Util.incrementMessageCounter();
  conversation.queueJob('addChatSessionRefreshed', async () => {
    conversation.addChatSessionRefreshed({ receivedAt, receivedAtCounter });
  });
}
