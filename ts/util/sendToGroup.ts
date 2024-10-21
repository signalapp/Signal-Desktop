// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { differenceWith, omit } from 'lodash';
import { v4 as generateUuid } from 'uuid';

import {
  ErrorCode,
  LibSignalErrorBase,
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
import * as Errors from '../types/errors';
import { DataWriter } from '../sql/Client';
import { getValue } from '../RemoteConfig';
import type { ServiceIdString } from '../types/ServiceId';
import { ServiceIdKind } from '../types/ServiceId';
import { isRecord } from './isRecord';

import { isOlderThan } from './timestamp';
import type {
  GroupSendOptionsType,
  SendOptionsType,
} from '../textsecure/SendMessage';
import {
  ConnectTimeoutError,
  IncorrectSenderKeyAuthError,
  OutgoingIdentityKeyError,
  SendMessageProtoError,
  UnknownRecipientError,
  UnregisteredUserError,
} from '../textsecure/Errors';
import type { HTTPError } from '../textsecure/Errors';
import { IdentityKeys, SenderKeys, Sessions } from '../LibSignalStores';
import type { ConversationModel } from '../models/conversations';
import type { DeviceType, CallbackResultType } from '../textsecure/Types.d';
import { getKeysForServiceId } from '../textsecure/getKeysForServiceId';
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
import { waitForAll } from './waitForAll';
import type { GroupSendEndorsementState } from './groupSendEndorsements';
import {
  maybeCreateGroupSendEndorsementState,
  onFailedToSendWithEndorsements,
} from './groupSendEndorsements';
import type { GroupSendToken } from '../types/GroupSendEndorsements';
import { isAciString } from './isAciString';
import { safeParseStrict, safeParseUnknown } from './schemas';

const UNKNOWN_RECIPIENT = 404;
const INCORRECT_AUTH_KEY = 401;
const ERROR_EXPIRED_OR_MISSING_DEVICES = 409;
const ERROR_STALE_DEVICES = 410;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// sendWithSenderKey is recursive, but we don't want to loop back too many times.
const MAX_RECURSION = 10;

const ACCESS_KEY_LENGTH = 16;
const ZERO_ACCESS_KEY = Bytes.toBase64(new Uint8Array(ACCESS_KEY_LENGTH));

// Public API:

export type SenderKeyTargetType = {
  getGroupId: () => string | undefined;
  getMembers: () => Array<ConversationModel>;
  hasMember: (serviceId: ServiceIdString) => boolean;
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
  story,
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
  story?: boolean;
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
  const contentMessage =
    await window.textsecure.messaging.getContentMessage(protoAttributes);

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
    story,
    timestamp,
    urgent,
  });
}

type SendToGroupOptions = Readonly<{
  contentHint: number;
  contentMessage: Proto.Content;
  isPartialSend?: boolean;
  messageId: string | undefined;
  online?: boolean;
  recipients: ReadonlyArray<ServiceIdString>;
  sendOptions?: SendOptionsType;
  sendTarget: SenderKeyTargetType;
  sendType: SendTypesType;
  story?: boolean;
  timestamp: number;
  urgent: boolean;
}>;

// Note: This is the group send chokepoint. The 1:1 send chokepoint is sendMessageProto.
export async function sendContentMessageToGroup(
  options: SendToGroupOptions
): Promise<CallbackResultType> {
  const {
    contentHint,
    contentMessage,
    messageId,
    online,
    recipients,
    sendOptions,
    sendTarget,
    sendType,
    story,
    timestamp,
    urgent,
  } = options;
  const logId = sendTarget.idForLogging();

  const accountManager = window.getAccountManager();
  if (accountManager.areKeysOutOfDate(ServiceIdKind.ACI)) {
    log.warn(
      `sendToGroup/${logId}: Keys are out of date; updating before send`
    );
    await accountManager.maybeUpdateKeys(ServiceIdKind.ACI);
    if (accountManager.areKeysOutOfDate(ServiceIdKind.ACI)) {
      throw new Error('Keys still out of date after update');
    }
  }

  strictAssert(
    window.textsecure.messaging,
    'sendContentMessageToGroup: textsecure.messaging not available!'
  );

  if (sendTarget.isValid()) {
    try {
      return await sendToGroupViaSenderKey(options, {
        count: 0,
        didRefreshGroupState: false,
        reason: 'init (sendContentMessageToGroup)',
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
        Errors.toLogFormat(error)
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
    hasPniSignatureMessage: false,
  });
  const groupId = sendTarget.isGroupV2() ? sendTarget.getGroupId() : undefined;
  return window.textsecure.messaging.sendGroupProto({
    contentHint,
    groupId,
    options: { ...sendOptions, online },
    proto: contentMessage,
    recipients,
    sendLogCallback,
    story,
    timestamp,
    urgent,
  });
}

// The Primary Sender Key workflow

type SendRecursion = {
  count: number;
  didRefreshGroupState: boolean;
  reason: string;
};

export async function sendToGroupViaSenderKey(
  options: SendToGroupOptions,
  recursion: SendRecursion
): Promise<CallbackResultType> {
  function startOver(
    reason: string,
    didRefreshGroupState = recursion.didRefreshGroupState
  ) {
    return sendToGroupViaSenderKey(options, {
      count: recursion.count + 1,
      didRefreshGroupState,
      reason,
    });
  }

  const {
    contentHint,
    contentMessage,
    isPartialSend,
    messageId,
    online,
    recipients,
    sendOptions,
    sendTarget,
    sendType,
    story,
    timestamp,
    urgent,
  } = options;
  const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

  const logId = `sendToGroupViaSenderKey/${sendTarget.idForLogging()}`;
  log.info(
    `${logId}: Starting ${timestamp}, recursion count ${recursion.count}, reason: ${recursion.reason}...`
  );

  if (recursion.count > MAX_RECURSION) {
    throw new Error(
      `${logId}: Too much recursion! Count is at ${recursion.count}`
    );
  }

  const groupId = sendTarget.getGroupId();
  if (!sendTarget.isValid()) {
    throw new Error(`${logId}: sendTarget is not valid!`);
  }

  if (
    contentHint !== ContentHint.DEFAULT &&
    contentHint !== ContentHint.RESENDABLE &&
    contentHint !== ContentHint.IMPLICIT
  ) {
    throw new Error(`${logId}: Invalid contentHint ${contentHint}`);
  }

  strictAssert(
    window.textsecure.messaging,
    'sendToGroupViaSenderKey: textsecure.messaging not available!'
  );

  // 1. Add sender key info if we have none, or clear out if it's too old
  // Note: From here on, generally need to recurse if we change senderKeyInfo
  const senderKeyInfo = sendTarget.getSenderKeyInfo();

  if (!senderKeyInfo) {
    log.info(`${logId}: Adding initial sender key info`);
    await sendTarget.saveSenderKeyInfo({
      createdAtDate: Date.now(),
      distributionId: generateUuid(),
      memberDevices: [],
    });

    // Restart here because we updated senderKeyInfo
    return startOver('Added missing sender key info');
  }

  const EXPIRE_DURATION = getSenderKeyExpireDuration();
  if (isOlderThan(senderKeyInfo.createdAtDate, EXPIRE_DURATION)) {
    const { createdAtDate } = senderKeyInfo;
    log.info(`${logId}: Resetting sender key; ${createdAtDate} is too old`);
    await resetSenderKey(sendTarget);

    // Restart here because we updated senderKeyInfo
    return startOver('sender key info expired');
  }

  // 2. Fetch all devices we believe we'll be sending to
  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const { devices: currentDevices, emptyServiceIds } =
    await window.textsecure.storage.protocol.getOpenDevices(ourAci, recipients);

  let groupSendEndorsementState: GroupSendEndorsementState | null = null;
  if (groupId != null && !story) {
    const { state, didRefreshGroupState } =
      await maybeCreateGroupSendEndorsementState(
        groupId,
        recursion.didRefreshGroupState
      );
    if (state != null) {
      groupSendEndorsementState = state;
    } else if (didRefreshGroupState) {
      return startOver(
        'group send endorsements outside expiration range',
        true
      );
    }
  }

  // 3. If we have no open sessions with people we believe we are sending to, and we
  //   believe that any have signal accounts, fetch their prekey bundle and start
  //   sessions with them.
  if (
    emptyServiceIds.length > 0 &&
    emptyServiceIds.some(isServiceIdRegistered)
  ) {
    await fetchKeysForServiceIds(emptyServiceIds, groupSendEndorsementState);

    // Restart here to capture devices for accounts we just started sessions with
    return startOver('fetched prekey bundles');
  }

  const { memberDevices, distributionId, createdAtDate } = senderKeyInfo;
  const memberSet = new Set(sendTarget.getMembers());

  // 4. Partition devices into sender key and non-sender key groups
  const devicesForSenderKey: Array<DeviceType> = [];
  const devicesForNormalSend: Array<DeviceType> = [];

  for (const device of currentDevices) {
    if (
      isValidSenderKeyRecipient(
        memberSet,
        groupSendEndorsementState,
        device.serviceId,
        { story }
      )
    ) {
      devicesForSenderKey.push(device);
    } else {
      devicesForNormalSend.push(device);
    }
  }

  const senderKeyRecipients = getServiceIdsFromDevices(devicesForSenderKey);
  const normalSendRecipients = getServiceIdsFromDevices(devicesForNormalSend);
  log.info(
    `${logId}:` +
      ` ${senderKeyRecipients.length} accounts for sender key (${devicesForSenderKey.length} devices),` +
      ` ${normalSendRecipients.length} accounts for normal send (${devicesForNormalSend.length} devices)`
  );

  // 5. Ensure we have enough recipients
  if (senderKeyRecipients.length < 2) {
    throw new Error(
      `${logId}: Not enough recipients for Sender Key message. Failing over.`
    );
  }

  // 6. Analyze target devices for sender key, determine which have been added or removed
  const {
    newToMemberDevices,
    newToMemberServiceIds,
    removedFromMemberDevices,
    removedFromMemberServiceIds,
  } = _analyzeSenderKeyDevices(
    memberDevices,
    devicesForSenderKey,
    isPartialSend
  );

  // 7. If members have been removed from the group, we need to reset our sender key, then
  //   start over to get a fresh set of target devices.
  const keyNeedsReset = Array.from(removedFromMemberServiceIds).some(
    serviceId => !sendTarget.hasMember(serviceId)
  );
  if (keyNeedsReset) {
    await resetSenderKey(sendTarget);

    // Restart here to start over; empty memberDevices means we'll send distribution
    //   message to everyone.
    return startOver('removed members in send target');
  }

  // 8. If there are new members or new devices in the group, we need to ensure that they
  //   have our sender key before we send sender key messages to them.
  if (newToMemberServiceIds.length > 0) {
    log.info(
      `${logId}: Sending sender key to ${
        newToMemberServiceIds.length
      } members: ${JSON.stringify(newToMemberServiceIds)}`
    );
    try {
      await handleMessageSend(
        window.textsecure.messaging.sendSenderKeyDistributionMessage(
          {
            contentHint,
            distributionId,
            groupId,
            serviceIds: newToMemberServiceIds,
            // SKDMs should only have story=true if we're sending to a distribution list
            story: sendTarget.getGroupId() ? false : story,
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
    return startOver('sent skdm to new members');
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
  let senderKeyRecipientsWithDevices: Record<
    ServiceIdString,
    Array<number>
  > = {};
  devicesForSenderKey.forEach(item => {
    const { id, serviceId } = item;
    senderKeyRecipientsWithDevices[serviceId] ||= [];
    senderKeyRecipientsWithDevices[serviceId].push(id);
  });

  let groupSendToken: GroupSendToken | null = null;
  let accessKeys: Buffer | null = null;
  if (groupSendEndorsementState != null) {
    groupSendToken = groupSendEndorsementState.buildToken(
      new Set(senderKeyRecipients)
    );
  } else {
    accessKeys = getXorOfAccessKeys(devicesForSenderKey, { story });
  }

  try {
    const messageBuffer = await encryptForSenderKey({
      contentHint,
      devices: devicesForSenderKey,
      distributionId,
      contentMessage: Proto.Content.encode(contentMessage).finish(),
      groupId,
    });

    const result = await window.textsecure.messaging.server.sendWithSenderKey(
      messageBuffer,
      accessKeys,
      groupSendToken,
      timestamp,
      { online, story, urgent }
    );

    const parsed = safeParseStrict(multiRecipient200ResponseSchema, result);
    if (parsed.success) {
      const { uuids404 } = parsed.data;
      if (uuids404 && uuids404.length > 0) {
        await waitForAll({
          tasks: uuids404.map(
            serviceId => async () => markServiceIdUnregistered(serviceId)
          ),
        });
      }

      senderKeyRecipientsWithDevices = omit(
        senderKeyRecipientsWithDevices,
        uuids404 || []
      );
    } else {
      log.error(
        `${logId}: Server returned unexpected 200 response ${JSON.stringify(
          parsed.error.flatten()
        )}`
      );
    }

    if (shouldSaveProto(sendType)) {
      sendLogId = await DataWriter.insertSentProto(
        {
          contentHint,
          proto: Buffer.from(Proto.Content.encode(contentMessage).finish()),
          timestamp,
          urgent,
          hasPniSignatureMessage: false,
        },
        {
          recipients: senderKeyRecipientsWithDevices,
          messageIds: messageId ? [messageId] : [],
        }
      );
    }
  } catch (error) {
    if (error.code === UNKNOWN_RECIPIENT) {
      onFailedToSendWithEndorsements(error);
      throw new UnknownRecipientError();
    }
    if (error.code === INCORRECT_AUTH_KEY) {
      onFailedToSendWithEndorsements(error);
      throw new IncorrectSenderKeyAuthError();
    }

    if (error.code === ERROR_EXPIRED_OR_MISSING_DEVICES) {
      await handle409Response(sendTarget, groupSendEndorsementState, error);

      // Restart here to capture the right set of devices for our next send.
      return startOver('error: expired or missing devices');
    }
    if (error.code === ERROR_STALE_DEVICES) {
      await handle410Response(sendTarget, groupSendEndorsementState, error);

      // Restart here to use the right registrationIds for devices we already knew about,
      //   as well as send our sender key to these re-registered or re-linked devices.
      return startOver('error: stale devices');
    }
    if (
      error instanceof LibSignalErrorBase &&
      error.code === ErrorCode.InvalidRegistrationId
    ) {
      const address = error.addr as ProtocolAddress;
      const name = address.name();

      const brokenAccount = window.ConversationController.get(name);
      if (brokenAccount) {
        log.warn(
          `${logId}: Disabling sealed sender for ${brokenAccount.idForLogging()}`
        );
        brokenAccount.set({ sealedSender: SEALED_SENDER.DISABLED });
        await DataWriter.updateConversation(brokenAccount.attributes);

        // Now that we've eliminate this problematic account, we can try the send again.
        return startOver('error: invalid registration id');
      }
    }

    if (groupSendEndorsementState != null) {
      onFailedToSendWithEndorsements(error);
    }

    log.error(
      `${logId}: Returned unexpected error code: ${
        error.code
      }, error class: ${typeof error}`
    );

    throw error;
  }

  // 11. Return early if there are no normal send recipients
  if (normalSendRecipients.length === 0) {
    return {
      dataMessage: contentMessage.dataMessage
        ? Proto.DataMessage.encode(contentMessage.dataMessage).finish()
        : undefined,
      editMessage: contentMessage.editMessage
        ? Proto.EditMessage.encode(contentMessage.editMessage).finish()
        : undefined,
      successfulServiceIds: senderKeyRecipients,
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
    serviceId,
    deviceIds,
  }: {
    serviceId: ServiceIdString;
    deviceIds: Array<number>;
  }) => {
    if (!shouldSaveProto(sendType)) {
      return;
    }

    const sentToConversation = window.ConversationController.get(serviceId);
    if (!sentToConversation) {
      log.warn(
        `sendToGroupViaSenderKey/callback: Unable to find conversation for serviceId ${serviceId}`
      );
      return;
    }
    const recipientServiceId = sentToConversation.getServiceId();
    if (!recipientServiceId) {
      log.warn(
        `sendToGroupViaSenderKey/callback: Conversation ${sentToConversation.idForLogging()} had no service id`
      );
      return;
    }

    await DataWriter.insertProtoRecipients({
      id: sendLogId,
      recipientServiceId,
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

// Public utility methods

export async function resetSenderKey(
  sendTarget: SenderKeyTargetType
): Promise<void> {
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

  const ourAci = window.storage.user.getCheckedAci();
  await window.textsecure.storage.protocol.removeSenderKey(
    new QualifiedAddress(ourAci, ourAddress),
    distributionId
  );
}

// Utility Methods

function mergeSendResult({
  result,
  senderKeyRecipients,
  senderKeyRecipientsWithDevices,
}: {
  result: CallbackResultType | SendMessageProtoError;
  senderKeyRecipients: Array<ServiceIdString>;
  senderKeyRecipientsWithDevices: Record<ServiceIdString, Array<number>>;
}): CallbackResultType {
  return {
    ...result,
    successfulServiceIds: [
      ...(result.successfulServiceIds || []),
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
      Errors.toLogFormat(error)
    );
    return MAX_SENDER_KEY_EXPIRE_DURATION;
  }
}

export function _shouldFailSend(error: unknown, logId: string): boolean {
  const logError = (message: string) => {
    log.error(`_shouldFailSend/${logId}: ${message}`);
  };

  // We need to fail over to a normal send if multi_recipient/ endpoint returns 404 or 401
  if (error instanceof UnknownRecipientError) {
    return false;
  }
  if (error instanceof IncorrectSenderKeyAuthError) {
    return false;
  }

  if (
    error instanceof LibSignalErrorBase &&
    error.code === ErrorCode.UntrustedIdentity
  ) {
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
    if (error.code === -1) {
      logError("We don't have connectivity. Failing.");
      return true;
    }

    if (error.code === 400) {
      logError('Invalid request, failing.');
      return true;
    }

    if (error.code === 404) {
      logError('Failed to fetch metadata before send, failing.');
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
      logError('SendMessageProtoError had no errors but was thrown! Failing.');
      return true;
    }

    if (error.successfulServiceIds && error.successfulServiceIds.length > 0) {
      logError(
        'SendMessageProtoError had successful sends; no further sends needed. Failing.'
      );
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

function getRecipients(
  options: GroupSendOptionsType
): ReadonlyArray<ServiceIdString> {
  if (options.groupV2) {
    return options.groupV2.members;
  }

  throw new Error('getRecipients: Unable to extract recipients!');
}

async function markServiceIdUnregistered(serviceId: ServiceIdString) {
  const conversation = window.ConversationController.getOrCreate(
    serviceId,
    'private'
  );

  conversation.setUnregistered();
  await DataWriter.updateConversation(conversation.attributes);

  await window.textsecure.storage.protocol.archiveAllSessions(serviceId);
}

function isServiceIdRegistered(serviceId: ServiceIdString) {
  const conversation = window.ConversationController.getOrCreate(
    serviceId,
    'private'
  );
  const isUnregistered = conversation.isUnregistered();

  return !isUnregistered;
}

async function handle409Response(
  sendTarget: SenderKeyTargetType,
  groupSendEndorsementState: GroupSendEndorsementState | null,
  error: HTTPError
) {
  const logId = sendTarget.idForLogging();
  const parsed = safeParseUnknown(
    multiRecipient409ResponseSchema,
    error.response
  );
  if (parsed.success) {
    await waitForAll({
      tasks: parsed.data.map(item => async () => {
        const { uuid, devices } = item;
        // Start new sessions with devices we didn't know about before
        if (devices.missingDevices && devices.missingDevices.length > 0) {
          await fetchKeysForServiceId(
            uuid,
            devices.missingDevices,
            groupSendEndorsementState
          );
        }

        // Archive sessions with devices that have been removed
        if (devices.extraDevices && devices.extraDevices.length > 0) {
          const ourAci = window.textsecure.storage.user.getCheckedAci();

          await waitForAll({
            tasks: devices.extraDevices.map(deviceId => async () => {
              await window.textsecure.storage.protocol.archiveSession(
                new QualifiedAddress(ourAci, Address.create(uuid, deviceId))
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
  groupSendEndorsementState: GroupSendEndorsementState | null,
  error: HTTPError
) {
  const logId = sendTarget.idForLogging();

  const parsed = safeParseUnknown(
    multiRecipient410ResponseSchema,
    error.response
  );
  if (parsed.success) {
    await waitForAll({
      tasks: parsed.data.map(item => async () => {
        const { uuid, devices } = item;
        if (devices.staleDevices && devices.staleDevices.length > 0) {
          const ourAci = window.textsecure.storage.user.getCheckedAci();

          // First, archive our existing sessions with these devices
          await waitForAll({
            tasks: devices.staleDevices.map(deviceId => async () => {
              await window.textsecure.storage.protocol.archiveSession(
                new QualifiedAddress(ourAci, Address.create(uuid, deviceId))
              );
            }),
          });

          // Start new sessions with these devices
          await fetchKeysForServiceId(
            uuid,
            devices.staleDevices,
            groupSendEndorsementState
          );

          // Forget that we've sent our sender key to these devices, since they've
          //   been re-registered or re-linked.
          const senderKeyInfo = sendTarget.getSenderKeyInfo();
          if (senderKeyInfo) {
            const devicesToRemove: Array<PartialDeviceType> =
              devices.staleDevices.map(id => ({ id, serviceId: uuid }));
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

function getXorOfAccessKeys(
  devices: Array<DeviceType>,
  { story }: { story?: boolean } = {}
): Buffer {
  const uuids = getServiceIdsFromDevices(devices);

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

    const accessKey = getAccessKey(conversation.attributes, { story });
    if (!accessKey) {
      throw new Error(`getXorOfAccessKeys: No accessKey for UUID ${uuid}`);
    }
    strictAssert(
      typeof accessKey === 'string',
      'Cannot be endorsement in getXorOfAccessKeys'
    );

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
  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();
  if (!ourDeviceId) {
    throw new Error(
      'encryptForSenderKey: Unable to fetch our uuid or deviceId'
    );
  }

  const sender = ProtocolAddress.new(
    ourAci,
    parseIntOrThrow(ourDeviceId, 'encryptForSenderKey, ourDeviceId')
  );
  const ourAddress = getOurAddress();
  const senderKeyStore = new SenderKeys({
    ourServiceId: ourAci,
    zone: GLOBAL_ZONE,
  });
  const message = Buffer.from(padMessage(contentMessage));

  const ciphertextMessage =
    await window.textsecure.storage.protocol.enqueueSenderKeyJob(
      new QualifiedAddress(ourAci, ourAddress),
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
      if (a.serviceId === b.serviceId) {
        return 0;
      }

      if (a.serviceId < b.serviceId) {
        return -1;
      }

      return 1;
    })
    .map(device => {
      return ProtocolAddress.new(device.serviceId, device.id);
    });
  const identityKeyStore = new IdentityKeys({ ourServiceId: ourAci });
  const sessionStore = new Sessions({ ourServiceId: ourAci });
  return sealedSenderMultiRecipientEncrypt(
    content,
    recipients,
    identityKeyStore,
    sessionStore
  );
}

function isValidSenderKeyRecipient(
  members: Set<ConversationModel>,
  groupSendEndorsementState: GroupSendEndorsementState | null,
  serviceId: ServiceIdString,
  { story }: { story?: boolean } = {}
): boolean {
  const memberConversation = window.ConversationController.get(serviceId);
  if (!memberConversation) {
    log.warn(
      `isValidSenderKeyRecipient: Missing conversation model for member ${serviceId}`
    );
    return false;
  }

  if (!members.has(memberConversation)) {
    log.info(
      `isValidSenderKeyRecipient: Sending to ${serviceId}, not a group member`
    );
    return false;
  }

  if (groupSendEndorsementState != null) {
    if (!groupSendEndorsementState.hasMember(serviceId)) {
      onFailedToSendWithEndorsements(
        new Error(
          `isValidSenderKeyRecipient: Sending to ${serviceId}, missing endorsement`
        )
      );
      return false;
    }
  } else if (!getAccessKey(memberConversation.attributes, { story })) {
    return false;
  }

  if (memberConversation.isUnregistered()) {
    log.warn(`isValidSenderKeyRecipient: Member ${serviceId} is unregistered`);
    return false;
  }

  return true;
}

function deviceComparator(left?: DeviceType, right?: DeviceType): boolean {
  return Boolean(
    left &&
      right &&
      left.id === right.id &&
      left.serviceId === right.serviceId &&
      left.registrationId === right.registrationId
  );
}

type PartialDeviceType = Omit<DeviceType, 'registrationId'>;

function partialDeviceComparator(
  left?: PartialDeviceType,
  right?: PartialDeviceType
): boolean {
  return Boolean(
    left && right && left.id === right.id && left.serviceId === right.serviceId
  );
}

function getServiceIdsFromDevices(
  devices: Array<DeviceType>
): Array<ServiceIdString> {
  return [...new Set(devices.map(({ serviceId }) => serviceId))];
}

export function _analyzeSenderKeyDevices(
  memberDevices: Array<DeviceType>,
  devicesForSend: Array<DeviceType>,
  isPartialSend?: boolean
): {
  newToMemberDevices: Array<DeviceType>;
  newToMemberServiceIds: Array<ServiceIdString>;
  removedFromMemberDevices: Array<DeviceType>;
  removedFromMemberServiceIds: Array<ServiceIdString>;
} {
  const newToMemberDevices = differenceWith<DeviceType, DeviceType>(
    devicesForSend,
    memberDevices,
    deviceComparator
  );
  const newToMemberServiceIds = getServiceIdsFromDevices(newToMemberDevices);

  // If this is a partial send, we won't do anything with device removals
  if (isPartialSend) {
    return {
      newToMemberDevices,
      newToMemberServiceIds,
      removedFromMemberDevices: [],
      removedFromMemberServiceIds: [],
    };
  }

  const removedFromMemberDevices = differenceWith<DeviceType, DeviceType>(
    memberDevices,
    devicesForSend,
    deviceComparator
  );
  const removedFromMemberServiceIds = getServiceIdsFromDevices(
    removedFromMemberDevices
  );

  return {
    newToMemberDevices,
    newToMemberServiceIds,
    removedFromMemberDevices,
    removedFromMemberServiceIds,
  };
}

function getOurAddress(): Address {
  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();
  if (!ourDeviceId) {
    throw new Error('getOurAddress: Unable to fetch our deviceId');
  }
  return new Address(ourAci, ourDeviceId);
}

function getAccessKey(
  attributes: ConversationAttributesType,
  { story }: { story?: boolean }
): string | null {
  const { sealedSender, accessKey } = attributes;

  if (story) {
    return accessKey || ZERO_ACCESS_KEY;
  }

  if (sealedSender === SEALED_SENDER.ENABLED) {
    return accessKey || null;
  }

  if (sealedSender === SEALED_SENDER.UNKNOWN) {
    return accessKey || ZERO_ACCESS_KEY;
  }

  if (sealedSender === SEALED_SENDER.UNRESTRICTED) {
    return ZERO_ACCESS_KEY;
  }

  return null;
}

async function fetchKeysForServiceIds(
  serviceIds: Array<ServiceIdString>,
  groupSendEndorsementState: GroupSendEndorsementState | null
): Promise<void> {
  log.info(
    `fetchKeysForServiceIds: Fetching keys for ${serviceIds.length} serviceIds`
  );

  try {
    await waitForAll({
      tasks: serviceIds.map(
        serviceId => async () =>
          fetchKeysForServiceId(serviceId, null, groupSendEndorsementState)
      ),
    });
  } catch (error) {
    log.error(
      'fetchKeysForServiceIds: Failed to fetch keys:',
      Errors.toLogFormat(error)
    );
    throw error;
  }
}

async function fetchKeysForServiceId(
  serviceId: ServiceIdString,
  devices: Array<number> | null,
  groupSendEndorsementState: GroupSendEndorsementState | null
): Promise<void> {
  const logId = `fetchKeysForServiceId/${serviceId}`;
  log.info(`${logId}: Fetching ${devices || 'all'} devices`);

  if (!window.textsecure?.messaging?.server) {
    throw new Error('fetchKeysForServiceId: No server available!');
  }

  const emptyConversation = window.ConversationController.getOrCreate(
    serviceId,
    'private'
  );

  let useGroupSendEndorsement = isAciString(serviceId);
  if (!groupSendEndorsementState?.hasMember(serviceId)) {
    log.error(`fetchKeysForServiceId: ${serviceId} does not have endorsements`);
    useGroupSendEndorsement = false;
  }

  try {
    // Note: we have no way to make an unrestricted unauthenticated key fetch as part of a
    //   story send, so we hardcode story=false.
    const accessKey = getAccessKey(emptyConversation.attributes, {
      story: false,
    });

    let groupSendToken: GroupSendToken | null = null;

    if (useGroupSendEndorsement && groupSendEndorsementState != null) {
      groupSendToken = groupSendEndorsementState.buildToken(
        new Set([serviceId])
      );
    }

    const { accessKeyFailed } = await getKeysForServiceId(
      serviceId,
      window.textsecure?.messaging?.server,
      devices,
      accessKey,
      groupSendToken
    );
    if (accessKeyFailed) {
      log.info(
        `fetchKeysForServiceIds: Setting sealedSender to DISABLED for conversation ${emptyConversation.idForLogging()}`
      );
      emptyConversation.set({
        sealedSender: SEALED_SENDER.DISABLED,
      });
      await DataWriter.updateConversation(emptyConversation.attributes);
    }
  } catch (error: unknown) {
    if (error instanceof UnregisteredUserError) {
      await markServiceIdUnregistered(serviceId);
      return;
    }
    if (useGroupSendEndorsement) {
      onFailedToSendWithEndorsements(error as Error);
    }
    log.error(
      `${logId}: Error fetching ${devices || 'all'} devices`,
      Errors.toLogFormat(error)
    );
    throw error;
  }
}
