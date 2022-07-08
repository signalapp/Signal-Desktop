// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { differenceWith, omit, partition } from 'lodash';
import PQueue from 'p-queue';

import {
  ErrorCode,
  groupEncrypt,
  ProtocolAddress,
  sealedSenderMultiRecipientEncrypt,
  SenderCertificate,
  UnidentifiedSenderMessageContent,
} from '@signalapp/libsignal-client';
import * as Bytes from '../Bytes';
import { senderCertificateService } from '../services/senderCertificate';
import type { SendLogCallbackType } from '../textsecure/OutgoingMessage';
import {
  padMessage,
  SenderCertificateMode,
} from '../textsecure/OutgoingMessage';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { UUID } from '../types/UUID';
import { getValue, isEnabled } from '../RemoteConfig';
import type { UUIDStringType } from '../types/UUID';
import { isRecord } from './isRecord';

import { isOlderThan } from './timestamp';
import type {
  GroupSendOptionsType,
  SendOptionsType,
} from '../textsecure/SendMessage';
import {
  ConnectTimeoutError,
  OutgoingIdentityKeyError,
  SendMessageProtoError,
  UnregisteredUserError,
} from '../textsecure/Errors';
import type { HTTPError } from '../textsecure/Errors';
import { IdentityKeys, SenderKeys, Sessions } from '../LibSignalStores';
import type { ConversationModel } from '../models/conversations';
import type { DeviceType, CallbackResultType } from '../textsecure/Types.d';
import { getKeysForIdentifier } from '../textsecure/getKeysForIdentifier';
import type {
  ConversationAttributesType,
  SenderKeyInfoType,
} from '../model-types.d';
import type { SendTypesType } from './handleMessageSend';
import { handleMessageSend, shouldSaveProto } from './handleMessageSend';
import { SEALED_SENDER } from '../types/SealedSender';
import { parseIntOrThrow } from './parseIntOrThrow';
import {
  multiRecipient200ResponseSchema,
  multiRecipient409ResponseSchema,
  multiRecipient410ResponseSchema,
} from '../textsecure/WebAPI';
import { SignalService as Proto } from '../protobuf';

import { strictAssert } from './assert';
import * as log from '../logging/log';
import { GLOBAL_ZONE } from '../SignalProtocolStore';
import { MINUTE } from './durations';

const ERROR_EXPIRED_OR_MISSING_DEVICES = 409;
const ERROR_STALE_DEVICES = 410;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const MAX_CONCURRENCY = 5;

// sendWithSenderKey is recursive, but we don't want to loop back too many times.
const MAX_RECURSION = 10;

const ACCESS_KEY_LENGTH = 16;
const ZERO_ACCESS_KEY = Bytes.toBase64(new Uint8Array(ACCESS_KEY_LENGTH));

// Public API:

export type SenderKeyTargetType = {
  getGroupId: () => string | undefined;
  getMembers: () => Array<ConversationModel>;
  hasMember: (uuid: UUIDStringType) => boolean;
  idForLogging: () => string;
  isGroupV2: () => boolean;
  isValid: () => boolean;

  getSenderKeyInfo: () => SenderKeyInfoType | undefined;
  saveSenderKeyInfo: (senderKeyInfo: SenderKeyInfoType) => Promise<void>;
};

export async function sendToGroup({
  abortSignal,
  contentHint,
  groupSendOptions,
  isPartialSend,
  messageId,
  sendOptions,
  sendTarget,
  sendType,
  urgent,
}: {
  abortSignal?: AbortSignal;
  contentHint: number;
  groupSendOptions: GroupSendOptionsType;
  isPartialSend?: boolean;
  messageId: string | undefined;
  sendOptions?: SendOptionsType;
  sendTarget: SenderKeyTargetType;
  sendType: SendTypesType;
  urgent: boolean;
}): Promise<CallbackResultType> {
  strictAssert(
    window.textsecure.messaging,
    'sendToGroup: textsecure.messaging not available!'
  );

  const { timestamp } = groupSendOptions;
  const recipients = getRecipients(groupSendOptions);

  // First, do the attachment upload and prepare the proto we'll be sending
  const protoAttributes =
    window.textsecure.messaging.getAttrsFromGroupOptions(groupSendOptions);
  const contentMessage = await window.textsecure.messaging.getContentMessage(
    protoAttributes
  );

  // Attachment upload might take too long to succeed - we don't want to proceed
  // with the send if the caller aborted this call.
  if (abortSignal?.aborted) {
    throw new Error('sendToGroup was aborted');
  }

  return sendContentMessageToGroup({
    contentHint,
    contentMessage,
    isPartialSend,
    messageId,
    recipients,
    sendOptions,
    sendTarget,
    sendType,
    timestamp,
    urgent,
  });
}

export async function sendContentMessageToGroup({
  contentHint,
  contentMessage,
  isPartialSend,
  messageId,
  online,
  recipients,
  sendOptions,
  sendTarget,
  sendType,
  timestamp,
  urgent,
}: {
  contentHint: number;
  contentMessage: Proto.Content;
  isPartialSend?: boolean;
  messageId: string | undefined;
  online?: boolean;
  recipients: Array<string>;
  sendOptions?: SendOptionsType;
  sendTarget: SenderKeyTargetType;
  sendType: SendTypesType;
  timestamp: number;
  urgent: boolean;
}): Promise<CallbackResultType> {
  const logId = sendTarget.idForLogging();
  strictAssert(
    window.textsecure.messaging,
    'sendContentMessageToGroup: textsecure.messaging not available!'
  );

  const ourConversationId =
    window.ConversationController.getOurConversationIdOrThrow();
  const ourConversation = window.ConversationController.get(ourConversationId);

  if (
    isEnabled('desktop.sendSenderKey3') &&
    isEnabled('desktop.senderKey.send') &&
    ourConversation?.get('capabilities')?.senderKey &&
    sendTarget.isValid()
  ) {
    try {
      return await sendToGroupViaSenderKey({
        contentHint,
        contentMessage,
        isPartialSend,
        messageId,
        online,
        recipients,
        recursionCount: 0,
        sendOptions,
        sendTarget,
        sendType,
        timestamp,
        urgent,
      });
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (_shouldFailSend(error, logId)) {
        throw error;
      }

      log.error(
        `sendToGroup/${logId}: Sender Key send failed, logging, proceeding to normal send`,
        error && error.stack ? error.stack : error
      );
    }
  }

  const sendLogCallback = window.textsecure.messaging.makeSendLogCallback({
    contentHint,
    messageId,
    proto: Buffer.from(Proto.Content.encode(contentMessage).finish()),
    sendType,
    timestamp,
    urgent,
  });
  const groupId = sendTarget.isGroupV2() ? sendTarget.getGroupId() : undefined;
  return window.textsecure.messaging.sendGroupProto({
    contentHint,
    groupId,
    options: { ...sendOptions, online },
    proto: contentMessage,
    recipients,
    sendLogCallback,
    timestamp,
    urgent,
  });
}

// The Primary Sender Key workflow

export async function sendToGroupViaSenderKey(options: {
  contentHint: number;
  contentMessage: Proto.Content;
  isPartialSend?: boolean;
  messageId: string | undefined;
  online?: boolean;
  recipients: Array<string>;
  recursionCount: number;
  sendOptions?: SendOptionsType;
  sendTarget: SenderKeyTargetType;
  sendType: SendTypesType;
  timestamp: number;
  urgent: boolean;
}): Promise<CallbackResultType> {
  const {
    contentHint,
    contentMessage,
    isPartialSend,
    messageId,
    online,
    recipients,
    recursionCount,
    sendOptions,
    sendTarget,
    sendType,
    timestamp,
    urgent,
  } = options;
  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

  const logId = sendTarget.idForLogging();
  log.info(
    `sendToGroupViaSenderKey/${logId}: Starting ${timestamp}, recursion count ${recursionCount}...`
  );

  if (recursionCount > MAX_RECURSION) {
    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Too much recursion! Count is at ${recursionCount}`
    );
  }

  const groupId = sendTarget.getGroupId();
  if (!sendTarget.isValid()) {
    throw new Error(
      `sendToGroupViaSenderKey/${logId}: sendTarget is not valid!`
    );
  }

  if (
    contentHint !== ContentHint.DEFAULT &&
    contentHint !== ContentHint.RESENDABLE &&
    contentHint !== ContentHint.IMPLICIT
  ) {
    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Invalid contentHint ${contentHint}`
    );
  }

  strictAssert(
    window.textsecure.messaging,
    'sendToGroupViaSenderKey: textsecure.messaging not available!'
  );

  // 1. Add sender key info if we have none, or clear out if it's too old
  const EXPIRE_DURATION = getSenderKeyExpireDuration();

  // Note: From here on, generally need to recurse if we change senderKeyInfo
  const senderKeyInfo = sendTarget.getSenderKeyInfo();

  if (!senderKeyInfo) {
    log.info(
      `sendToGroupViaSenderKey/${logId}: Adding initial sender key info`
    );
    await sendTarget.saveSenderKeyInfo({
      createdAtDate: Date.now(),
      distributionId: UUID.generate().toString(),
      memberDevices: [],
    });

    // Restart here because we updated senderKeyInfo
    return sendToGroupViaSenderKey({
      ...options,
      recursionCount: recursionCount + 1,
    });
  }
  if (isOlderThan(senderKeyInfo.createdAtDate, EXPIRE_DURATION)) {
    const { createdAtDate } = senderKeyInfo;
    log.info(
      `sendToGroupViaSenderKey/${logId}: Resetting sender key; ${createdAtDate} is too old`
    );
    await resetSenderKey(sendTarget);

    // Restart here because we updated senderKeyInfo
    return sendToGroupViaSenderKey({
      ...options,
      recursionCount: recursionCount + 1,
    });
  }

  // 2. Fetch all devices we believe we'll be sending to
  const ourUuid = window.textsecure.storage.user.getCheckedUuid();
  const { devices: currentDevices, emptyIdentifiers } =
    await window.textsecure.storage.protocol.getOpenDevices(
      ourUuid,
      recipients
    );

  // 3. If we have no open sessions with people we believe we are sending to, and we
  //   believe that any have signal accounts, fetch their prekey bundle and start
  //   sessions with them.
  if (
    emptyIdentifiers.length > 0 &&
    emptyIdentifiers.some(isIdentifierRegistered)
  ) {
    await fetchKeysForIdentifiers(emptyIdentifiers);

    // Restart here to capture devices for accounts we just started sessions with
    return sendToGroupViaSenderKey({
      ...options,
      recursionCount: recursionCount + 1,
    });
  }

  const { memberDevices, distributionId, createdAtDate } = senderKeyInfo;
  const memberSet = new Set(sendTarget.getMembers());

  // 4. Partition devices into sender key and non-sender key groups
  const [devicesForSenderKey, devicesForNormalSend] = partition(
    currentDevices,
    device => isValidSenderKeyRecipient(memberSet, device.identifier)
  );

  const senderKeyRecipients = getUuidsFromDevices(devicesForSenderKey);
  const normalSendRecipients = getUuidsFromDevices(devicesForNormalSend);
  log.info(
    `sendToGroupViaSenderKey/${logId}:` +
      ` ${senderKeyRecipients.length} accounts for sender key (${devicesForSenderKey.length} devices),` +
      ` ${normalSendRecipients.length} accounts for normal send (${devicesForNormalSend.length} devices)`
  );

  // 5. Ensure we have enough recipients
  if (senderKeyRecipients.length < 2) {
    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Not enough recipients for Sender Key message. Failing over.`
    );
  }

  // 6. Analyze target devices for sender key, determine which have been added or removed
  const {
    newToMemberDevices,
    newToMemberUuids,
    removedFromMemberDevices,
    removedFromMemberUuids,
  } = _analyzeSenderKeyDevices(
    memberDevices,
    devicesForSenderKey,
    isPartialSend
  );

  // 7. If members have been removed from the group, we need to reset our sender key, then
  //   start over to get a fresh set of target devices.
  const keyNeedsReset = Array.from(removedFromMemberUuids).some(
    uuid => !sendTarget.hasMember(uuid)
  );
  if (keyNeedsReset) {
    await resetSenderKey(sendTarget);

    // Restart here to start over; empty memberDevices means we'll send distribution
    //   message to everyone.
    return sendToGroupViaSenderKey({
      ...options,
      recursionCount: recursionCount + 1,
    });
  }

  // 8. If there are new members or new devices in the group, we need to ensure that they
  //   have our sender key before we send sender key messages to them.
  if (newToMemberUuids.length > 0) {
    log.info(
      `sendToGroupViaSenderKey/${logId}: Sending sender key to ${
        newToMemberUuids.length
      } members: ${JSON.stringify(newToMemberUuids)}`
    );
    try {
      await handleMessageSend(
        window.textsecure.messaging.sendSenderKeyDistributionMessage(
          {
            contentHint: ContentHint.RESENDABLE,
            distributionId,
            groupId,
            identifiers: newToMemberUuids,
            urgent,
          },
          sendOptions ? { ...sendOptions, online: false } : undefined
        ),
        { messageIds: [], sendType: 'senderKeyDistributionMessage' }
      );
    } catch (error) {
      // If we partially fail to send the sender key distribution message (SKDM), we don't
      //   want the successful SKDM sends to be considered an overall success.
      if (error instanceof SendMessageProtoError) {
        throw new SendMessageProtoError({
          ...error,
          sendIsNotFinal: true,
        });
      }

      throw error;
    }

    // Update memberDevices with new devices
    const updatedMemberDevices = [...memberDevices, ...newToMemberDevices];

    await sendTarget.saveSenderKeyInfo({
      createdAtDate,
      distributionId,
      memberDevices: updatedMemberDevices,
    });

    // Restart here because we might have discovered new or dropped devices as part of
    //   distributing our sender key.
    return sendToGroupViaSenderKey({
      ...options,
      recursionCount: recursionCount + 1,
    });
  }

  // 9. Update memberDevices with removals which didn't require a reset.
  if (removedFromMemberDevices.length > 0) {
    const updatedMemberDevices = [
      ...differenceWith<DeviceType, DeviceType>(
        memberDevices,
        removedFromMemberDevices,
        deviceComparator
      ),
    ];

    await sendTarget.saveSenderKeyInfo({
      createdAtDate,
      distributionId,
      memberDevices: updatedMemberDevices,
    });

    // Note, we do not need to restart here because we don't refer back to senderKeyInfo
    //   after this point.
  }

  // 10. Send the Sender Key message!
  let sendLogId: number;
  let senderKeyRecipientsWithDevices: Record<string, Array<number>> = {};
  devicesForSenderKey.forEach(item => {
    const { id, identifier } = item;
    senderKeyRecipientsWithDevices[identifier] ||= [];
    senderKeyRecipientsWithDevices[identifier].push(id);
  });

  try {
    const messageBuffer = await encryptForSenderKey({
      contentHint,
      devices: devicesForSenderKey,
      distributionId,
      contentMessage: Proto.Content.encode(contentMessage).finish(),
      groupId,
    });
    const accessKeys = getXorOfAccessKeys(devicesForSenderKey);

    const result = await window.textsecure.messaging.server.sendWithSenderKey(
      messageBuffer,
      accessKeys,
      timestamp,
      { online, urgent }
    );

    const parsed = multiRecipient200ResponseSchema.safeParse(result);
    if (parsed.success) {
      const { uuids404 } = parsed.data;
      if (uuids404 && uuids404.length > 0) {
        await _waitForAll({
          tasks: uuids404.map(
            uuid => async () => markIdentifierUnregistered(uuid)
          ),
        });
      }

      senderKeyRecipientsWithDevices = omit(
        senderKeyRecipientsWithDevices,
        uuids404 || []
      );
    } else {
      log.error(
        `sendToGroupViaSenderKey/${logId}: Server returned unexpected 200 response ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    if (shouldSaveProto(sendType)) {
      sendLogId = await window.Signal.Data.insertSentProto(
        {
          contentHint,
          proto: Buffer.from(Proto.Content.encode(contentMessage).finish()),
          timestamp,
          urgent,
        },
        {
          recipients: senderKeyRecipientsWithDevices,
          messageIds: messageId ? [messageId] : [],
        }
      );
    }
  } catch (error) {
    if (error.code === ERROR_EXPIRED_OR_MISSING_DEVICES) {
      await handle409Response(logId, error);

      // Restart here to capture the right set of devices for our next send.
      return sendToGroupViaSenderKey({
        ...options,
        recursionCount: recursionCount + 1,
      });
    }
    if (error.code === ERROR_STALE_DEVICES) {
      await handle410Response(sendTarget, error);

      // Restart here to use the right registrationIds for devices we already knew about,
      //   as well as send our sender key to these re-registered or re-linked devices.
      return sendToGroupViaSenderKey({
        ...options,
        recursionCount: recursionCount + 1,
      });
    }
    if (error.code === ErrorCode.InvalidRegistrationId && error.addr) {
      const address = error.addr as ProtocolAddress;
      const name = address.name();

      const brokenAccount = window.ConversationController.get(name);
      if (brokenAccount) {
        log.warn(
          `sendToGroupViaSenderKey/${logId}: Disabling sealed sender for ${brokenAccount.idForLogging()}`
        );
        brokenAccount.set({ sealedSender: SEALED_SENDER.DISABLED });
        window.Signal.Data.updateConversation(brokenAccount.attributes);

        // Now that we've eliminate this problematic account, we can try the send again.
        return sendToGroupViaSenderKey({
          ...options,
          recursionCount: recursionCount + 1,
        });
      }
    }

    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Returned unexpected error ${
        error.code
      }. Failing over. ${error.stack || error}`
    );
  }

  // 11. Return early if there are no normal send recipients
  if (normalSendRecipients.length === 0) {
    return {
      dataMessage: contentMessage.dataMessage
        ? Proto.DataMessage.encode(contentMessage.dataMessage).finish()
        : undefined,
      successfulIdentifiers: senderKeyRecipients,
      unidentifiedDeliveries: senderKeyRecipients,

      contentHint,
      timestamp,
      contentProto: Buffer.from(Proto.Content.encode(contentMessage).finish()),
      recipients: senderKeyRecipientsWithDevices,
      urgent,
    };
  }

  // 12. Send normal message to the leftover normal recipients. Then combine normal send
  //    result with result from sender key send for final return value.

  // We don't want to use a normal send log callback here, because the proto has already
  //   been saved as part of the Sender Key send. We're just adding recipients here.
  const sendLogCallback: SendLogCallbackType = async ({
    identifier,
    deviceIds,
  }: {
    identifier: string;
    deviceIds: Array<number>;
  }) => {
    if (!shouldSaveProto(sendType)) {
      return;
    }

    const sentToConversation = window.ConversationController.get(identifier);
    if (!sentToConversation) {
      log.warn(
        `sendToGroupViaSenderKey/callback: Unable to find conversation for identifier ${identifier}`
      );
      return;
    }
    const recipientUuid = sentToConversation.get('uuid');
    if (!recipientUuid) {
      log.warn(
        `sendToGroupViaSenderKey/callback: Conversation ${sentToConversation.idForLogging()} had no UUID`
      );
      return;
    }

    await window.Signal.Data.insertProtoRecipients({
      id: sendLogId,
      recipientUuid,
      deviceIds,
    });
  };

  try {
    const normalSendResult = await window.textsecure.messaging.sendGroupProto({
      contentHint,
      groupId,
      options: { ...sendOptions, online },
      proto: contentMessage,
      recipients: normalSendRecipients,
      sendLogCallback,
      timestamp,
      urgent,
    });

    return mergeSendResult({
      result: normalSendResult,
      senderKeyRecipients,
      senderKeyRecipientsWithDevices,
    });
  } catch (error: unknown) {
    if (error instanceof SendMessageProtoError) {
      const callbackResult = mergeSendResult({
        result: error,
        senderKeyRecipients,
        senderKeyRecipientsWithDevices,
      });
      throw new SendMessageProtoError(callbackResult);
    }

    throw error;
  }
}

// Utility Methods

function mergeSendResult({
  result,
  senderKeyRecipients,
  senderKeyRecipientsWithDevices,
}: {
  result: CallbackResultType | SendMessageProtoError;
  senderKeyRecipients: Array<string>;
  senderKeyRecipientsWithDevices: Record<string, Array<number>>;
}): CallbackResultType {
  return {
    ...result,
    successfulIdentifiers: [
      ...(result.successfulIdentifiers || []),
      ...senderKeyRecipients,
    ],
    unidentifiedDeliveries: [
      ...(result.unidentifiedDeliveries || []),
      ...senderKeyRecipients,
    ],
    recipients: {
      ...result.recipients,
      ...senderKeyRecipientsWithDevices,
    },
  };
}

const MAX_SENDER_KEY_EXPIRE_DURATION = 90 * DAY;

function getSenderKeyExpireDuration(): number {
  try {
    const parsed = parseIntOrThrow(
      getValue('desktop.senderKeyMaxAge'),
      'getSenderKeyExpireDuration'
    );

    const duration = Math.min(parsed, MAX_SENDER_KEY_EXPIRE_DURATION);
    log.info(
      `getSenderKeyExpireDuration: using expire duration of ${duration}`
    );

    return duration;
  } catch (error) {
    log.warn(
      `getSenderKeyExpireDuration: Failed to parse integer. Using default of ${MAX_SENDER_KEY_EXPIRE_DURATION}.`,
      error && error.stack ? error.stack : error
    );
    return MAX_SENDER_KEY_EXPIRE_DURATION;
  }
}

export function _shouldFailSend(error: unknown, logId: string): boolean {
  const logError = (message: string) => {
    log.error(`_shouldFailSend/${logId}: ${message}`);
  };

  if (error instanceof Error && error.message.includes('untrusted identity')) {
    logError("'untrusted identity' error, failing.");
    return true;
  }

  if (error instanceof OutgoingIdentityKeyError) {
    logError('OutgoingIdentityKeyError error, failing.');
    return true;
  }

  if (error instanceof UnregisteredUserError) {
    logError('UnregisteredUserError error, failing.');
    return true;
  }

  if (error instanceof ConnectTimeoutError) {
    logError('ConnectTimeoutError error, failing.');
    return true;
  }

  // Known error types captured here:
  //   HTTPError
  //   OutgoingMessageError
  //   SendMessageNetworkError
  //   SendMessageChallengeError
  //   MessageError
  if (isRecord(error) && typeof error.code === 'number') {
    if (error.code === 400) {
      logError('Invalid request, failing.');
      return true;
    }

    if (error.code === 401) {
      logError('Permissions error, failing.');
      return true;
    }

    if (error.code === 404) {
      logError('Missing user or endpoint error, failing.');
      return true;
    }

    if (error.code === 413 || error.code === 429) {
      logError('Rate limit error, failing.');
      return true;
    }

    if (error.code === 428) {
      logError('Challenge error, failing.');
      return true;
    }

    if (error.code === 500) {
      logError('Server error, failing.');
      return true;
    }

    if (error.code === 508) {
      logError('Fail job error, failing.');
      return true;
    }
  }

  if (error instanceof SendMessageProtoError) {
    if (!error.errors || !error.errors.length) {
      logError('SendMessageProtoError had no errors, failing.');
      return true;
    }

    for (const innerError of error.errors) {
      const shouldFail = _shouldFailSend(innerError, logId);
      if (shouldFail) {
        return true;
      }
    }
  }

  return false;
}

export async function _waitForAll<T>({
  tasks,
  maxConcurrency = MAX_CONCURRENCY,
}: {
  tasks: Array<() => Promise<T>>;
  maxConcurrency?: number;
}): Promise<Array<T>> {
  const queue = new PQueue({
    concurrency: maxConcurrency,
    timeout: MINUTE * 30,
    throwOnTimeout: true,
  });
  return queue.addAll(tasks);
}

function getRecipients(options: GroupSendOptionsType): Array<string> {
  if (options.groupV2) {
    return options.groupV2.members;
  }
  if (options.groupV1) {
    return options.groupV1.members;
  }

  throw new Error('getRecipients: Unable to extract recipients!');
}

async function markIdentifierUnregistered(identifier: string) {
  const conversation = window.ConversationController.getOrCreate(
    identifier,
    'private'
  );

  conversation.setUnregistered();
  window.Signal.Data.updateConversation(conversation.attributes);

  const uuid = UUID.lookup(identifier);
  if (!uuid) {
    log.warn(`No uuid found for ${identifier}`);
    return;
  }

  await window.textsecure.storage.protocol.archiveAllSessions(uuid);
}

function isIdentifierRegistered(identifier: string) {
  const conversation = window.ConversationController.getOrCreate(
    identifier,
    'private'
  );
  const isUnregistered = conversation.isUnregistered();

  return !isUnregistered;
}

async function handle409Response(logId: string, error: HTTPError) {
  const parsed = multiRecipient409ResponseSchema.safeParse(error.response);
  if (parsed.success) {
    await _waitForAll({
      tasks: parsed.data.map(item => async () => {
        const { uuid, devices } = item;
        // Start new sessions with devices we didn't know about before
        if (devices.missingDevices && devices.missingDevices.length > 0) {
          await fetchKeysForIdentifier(uuid, devices.missingDevices);
        }

        // Archive sessions with devices that have been removed
        if (devices.extraDevices && devices.extraDevices.length > 0) {
          const ourUuid = window.textsecure.storage.user.getCheckedUuid();

          await _waitForAll({
            tasks: devices.extraDevices.map(deviceId => async () => {
              await window.textsecure.storage.protocol.archiveSession(
                new QualifiedAddress(ourUuid, Address.create(uuid, deviceId))
              );
            }),
          });
        }
      }),
      maxConcurrency: 2,
    });
  } else {
    log.error(
      `handle409Response/${logId}: Server returned unexpected 409 response ${JSON.stringify(
        parsed.error.flatten()
      )}`
    );
    throw error;
  }
}

async function handle410Response(
  sendTarget: SenderKeyTargetType,
  error: HTTPError
) {
  const logId = sendTarget.idForLogging();

  const parsed = multiRecipient410ResponseSchema.safeParse(error.response);
  if (parsed.success) {
    await _waitForAll({
      tasks: parsed.data.map(item => async () => {
        const { uuid, devices } = item;
        if (devices.staleDevices && devices.staleDevices.length > 0) {
          const ourUuid = window.textsecure.storage.user.getCheckedUuid();

          // First, archive our existing sessions with these devices
          await _waitForAll({
            tasks: devices.staleDevices.map(deviceId => async () => {
              await window.textsecure.storage.protocol.archiveSession(
                new QualifiedAddress(ourUuid, Address.create(uuid, deviceId))
              );
            }),
          });

          // Start new sessions with these devices
          await fetchKeysForIdentifier(uuid, devices.staleDevices);

          // Forget that we've sent our sender key to these devices, since they've
          //   been re-registered or re-linked.
          const senderKeyInfo = sendTarget.getSenderKeyInfo();
          if (senderKeyInfo) {
            const devicesToRemove: Array<PartialDeviceType> =
              devices.staleDevices.map(id => ({ id, identifier: uuid }));
            await sendTarget.saveSenderKeyInfo({
              ...senderKeyInfo,
              memberDevices: differenceWith(
                senderKeyInfo.memberDevices,
                devicesToRemove,
                partialDeviceComparator
              ),
            });
          }
        }
      }),
      maxConcurrency: 2,
    });
  } else {
    log.error(
      `handle410Response/${logId}: Server returned unexpected 410 response ${JSON.stringify(
        parsed.error.flatten()
      )}`
    );
    throw error;
  }
}

function getXorOfAccessKeys(devices: Array<DeviceType>): Buffer {
  const uuids = getUuidsFromDevices(devices);

  const result = Buffer.alloc(ACCESS_KEY_LENGTH);
  strictAssert(
    result.length === ACCESS_KEY_LENGTH,
    'getXorOfAccessKeys starting value'
  );

  uuids.forEach(uuid => {
    const conversation = window.ConversationController.get(uuid);
    if (!conversation) {
      throw new Error(
        `getXorOfAccessKeys: Unable to fetch conversation for UUID ${uuid}`
      );
    }

    const accessKey = getAccessKey(conversation.attributes);
    if (!accessKey) {
      throw new Error(`getXorOfAccessKeys: No accessKey for UUID ${uuid}`);
    }

    const accessKeyBuffer = Buffer.from(accessKey, 'base64');
    if (accessKeyBuffer.length !== ACCESS_KEY_LENGTH) {
      throw new Error(
        `getXorOfAccessKeys: Access key for ${uuid} had length ${accessKeyBuffer.length}`
      );
    }

    for (let i = 0; i < ACCESS_KEY_LENGTH; i += 1) {
      // eslint-disable-next-line no-bitwise
      result[i] ^= accessKeyBuffer[i];
    }
  });

  return result;
}

async function encryptForSenderKey({
  contentHint,
  contentMessage,
  devices,
  distributionId,
  groupId,
}: {
  contentHint: number;
  contentMessage: Uint8Array;
  devices: Array<DeviceType>;
  distributionId: string;
  groupId?: string;
}): Promise<Buffer> {
  const ourUuid = window.textsecure.storage.user.getCheckedUuid();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();
  if (!ourDeviceId) {
    throw new Error(
      'encryptForSenderKey: Unable to fetch our uuid or deviceId'
    );
  }

  const sender = ProtocolAddress.new(
    ourUuid.toString(),
    parseIntOrThrow(ourDeviceId, 'encryptForSenderKey, ourDeviceId')
  );
  const ourAddress = getOurAddress();
  const senderKeyStore = new SenderKeys({ ourUuid, zone: GLOBAL_ZONE });
  const message = Buffer.from(padMessage(contentMessage));

  const ciphertextMessage =
    await window.textsecure.storage.protocol.enqueueSenderKeyJob(
      new QualifiedAddress(ourUuid, ourAddress),
      () => groupEncrypt(sender, distributionId, senderKeyStore, message)
    );

  const groupIdBuffer = groupId ? Buffer.from(groupId, 'base64') : null;
  const senderCertificateObject = await senderCertificateService.get(
    SenderCertificateMode.WithoutE164
  );
  if (!senderCertificateObject) {
    throw new Error('encryptForSenderKey: Unable to fetch sender certificate!');
  }

  const senderCertificate = SenderCertificate.deserialize(
    Buffer.from(senderCertificateObject.serialized)
  );
  const content = UnidentifiedSenderMessageContent.new(
    ciphertextMessage,
    senderCertificate,
    contentHint,
    groupIdBuffer
  );

  const recipients = devices
    .slice()
    .sort((a, b): number => {
      if (a.identifier === b.identifier) {
        return 0;
      }

      if (a.identifier < b.identifier) {
        return -1;
      }

      return 1;
    })
    .map(device => {
      return ProtocolAddress.new(
        UUID.checkedLookup(device.identifier).toString(),
        device.id
      );
    });
  const identityKeyStore = new IdentityKeys({ ourUuid });
  const sessionStore = new Sessions({ ourUuid });
  return sealedSenderMultiRecipientEncrypt(
    content,
    recipients,
    identityKeyStore,
    sessionStore
  );
}

function isValidSenderKeyRecipient(
  members: Set<ConversationModel>,
  uuid: string
): boolean {
  const memberConversation = window.ConversationController.get(uuid);
  if (!memberConversation) {
    log.warn(
      `isValidSenderKeyRecipient: Missing conversation model for member ${uuid}`
    );
    return false;
  }

  if (!members.has(memberConversation)) {
    log.info(
      `isValidSenderKeyRecipient: Sending to ${uuid}, not a group member`
    );
    return false;
  }

  const capabilities = memberConversation.get('capabilities');
  if (!capabilities?.senderKey) {
    return false;
  }

  if (!getAccessKey(memberConversation.attributes)) {
    return false;
  }

  if (memberConversation.isUnregistered()) {
    log.warn(`isValidSenderKeyRecipient: Member ${uuid} is unregistered`);
    return false;
  }

  return true;
}

function deviceComparator(left?: DeviceType, right?: DeviceType): boolean {
  return Boolean(
    left &&
      right &&
      left.id === right.id &&
      left.identifier === right.identifier &&
      left.registrationId === right.registrationId
  );
}

type PartialDeviceType = Omit<DeviceType, 'registrationId'>;

function partialDeviceComparator(
  left?: PartialDeviceType,
  right?: PartialDeviceType
): boolean {
  return Boolean(
    left &&
      right &&
      left.id === right.id &&
      left.identifier === right.identifier
  );
}

function getUuidsFromDevices(
  devices: Array<DeviceType>
): Array<UUIDStringType> {
  const uuids = new Set<UUIDStringType>();
  devices.forEach(device => {
    uuids.add(UUID.checkedLookup(device.identifier).toString());
  });

  return Array.from(uuids);
}

export function _analyzeSenderKeyDevices(
  memberDevices: Array<DeviceType>,
  devicesForSend: Array<DeviceType>,
  isPartialSend?: boolean
): {
  newToMemberDevices: Array<DeviceType>;
  newToMemberUuids: Array<UUIDStringType>;
  removedFromMemberDevices: Array<DeviceType>;
  removedFromMemberUuids: Array<UUIDStringType>;
} {
  const newToMemberDevices = differenceWith<DeviceType, DeviceType>(
    devicesForSend,
    memberDevices,
    deviceComparator
  );
  const newToMemberUuids = getUuidsFromDevices(newToMemberDevices);

  // If this is a partial send, we won't do anything with device removals
  if (isPartialSend) {
    return {
      newToMemberDevices,
      newToMemberUuids,
      removedFromMemberDevices: [],
      removedFromMemberUuids: [],
    };
  }

  const removedFromMemberDevices = differenceWith<DeviceType, DeviceType>(
    memberDevices,
    devicesForSend,
    deviceComparator
  );
  const removedFromMemberUuids = getUuidsFromDevices(removedFromMemberDevices);

  return {
    newToMemberDevices,
    newToMemberUuids,
    removedFromMemberDevices,
    removedFromMemberUuids,
  };
}

function getOurAddress(): Address {
  const ourUuid = window.textsecure.storage.user.getCheckedUuid();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();
  if (!ourDeviceId) {
    throw new Error('getOurAddress: Unable to fetch our deviceId');
  }
  return new Address(ourUuid, ourDeviceId);
}

async function resetSenderKey(sendTarget: SenderKeyTargetType): Promise<void> {
  const logId = sendTarget.idForLogging();

  log.info(`resetSenderKey/${logId}: Sender key needs reset. Clearing data...`);
  const senderKeyInfo = sendTarget.getSenderKeyInfo();
  if (!senderKeyInfo) {
    log.warn(`resetSenderKey/${logId}: No sender key info`);
    return;
  }

  const { distributionId } = senderKeyInfo;
  const ourAddress = getOurAddress();

  // Note: We preserve existing distributionId to minimize space for sender key storage
  await sendTarget.saveSenderKeyInfo({
    createdAtDate: Date.now(),
    distributionId,
    memberDevices: [],
  });

  const ourUuid = window.storage.user.getCheckedUuid();
  await window.textsecure.storage.protocol.removeSenderKey(
    new QualifiedAddress(ourUuid, ourAddress),
    distributionId
  );
}

function getAccessKey(
  attributes: ConversationAttributesType
): string | undefined {
  const { sealedSender, accessKey } = attributes;

  if (sealedSender === SEALED_SENDER.ENABLED) {
    return accessKey || undefined;
  }

  if (
    sealedSender === SEALED_SENDER.UNKNOWN ||
    sealedSender === SEALED_SENDER.UNRESTRICTED
  ) {
    return ZERO_ACCESS_KEY;
  }

  return undefined;
}

async function fetchKeysForIdentifiers(
  identifiers: Array<string>
): Promise<void> {
  log.info(
    `fetchKeysForIdentifiers: Fetching keys for ${identifiers.length} identifiers`
  );

  try {
    await _waitForAll({
      tasks: identifiers.map(
        identifier => async () => fetchKeysForIdentifier(identifier)
      ),
    });
  } catch (error) {
    log.error(
      'fetchKeysForIdentifiers: Failed to fetch keys:',
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function fetchKeysForIdentifier(
  identifier: string,
  devices?: Array<number>
): Promise<void> {
  log.info(
    `fetchKeysForIdentifier: Fetching ${
      devices || 'all'
    } devices for ${identifier}`
  );

  if (!window.textsecure?.messaging?.server) {
    throw new Error('fetchKeysForIdentifier: No server available!');
  }

  const emptyConversation = window.ConversationController.getOrCreate(
    identifier,
    'private'
  );

  try {
    const { accessKeyFailed } = await getKeysForIdentifier(
      identifier,
      window.textsecure?.messaging?.server,
      devices,
      getAccessKey(emptyConversation.attributes)
    );
    if (accessKeyFailed) {
      log.info(
        `fetchKeysForIdentifiers: Setting sealedSender to DISABLED for conversation ${emptyConversation.idForLogging()}`
      );
      emptyConversation.set({
        sealedSender: SEALED_SENDER.DISABLED,
      });
      window.Signal.Data.updateConversation(emptyConversation.attributes);
    }
  } catch (error: unknown) {
    if (error instanceof UnregisteredUserError) {
      await markIdentifierUnregistered(identifier);
      return;
    }
    throw error;
  }
}
