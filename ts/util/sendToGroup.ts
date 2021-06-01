// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { differenceWith, partition } from 'lodash';
import PQueue from 'p-queue';

import {
  groupEncrypt,
  ProtocolAddress,
  sealedSenderMultiRecipientEncrypt,
  SenderCertificate,
  UnidentifiedSenderMessageContent,
} from '@signalapp/signal-client';
import { senderCertificateService } from '../services/senderCertificate';
import {
  padMessage,
  SenderCertificateMode,
} from '../textsecure/OutgoingMessage';

import { isOlderThan } from './timestamp';
import {
  CallbackResultType,
  GroupSendOptionsType,
  SendOptionsType,
} from '../textsecure/SendMessage';
import { IdentityKeys, SenderKeys, Sessions } from '../LibSignalStores';
import { ConversationModel } from '../models/conversations';
import { DeviceType } from '../textsecure/Types.d';
import { getKeysForIdentifier } from '../textsecure/getKeysForIdentifier';
import { ConversationAttributesType } from '../model-types.d';
import { SEALED_SENDER } from './handleMessageSend';
import { parseIntOrThrow } from './parseIntOrThrow';
import {
  multiRecipient200ResponseSchema,
  multiRecipient409ResponseSchema,
  multiRecipient410ResponseSchema,
} from '../textsecure/WebAPI';
import { ContentClass } from '../textsecure.d';

import { assert } from './assert';

const ERROR_EXPIRED_OR_MISSING_DEVICES = 409;
const ERROR_STALE_DEVICES = 410;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const MAX_CONCURRENCY = 5;

// sendWithSenderKey is recursive, but we don't want to loop back too many times.
const MAX_RECURSION = 5;

// Public API:

export async function sendToGroup(
  groupSendOptions: GroupSendOptionsType,
  conversation: ConversationModel,
  contentHint: number,
  sendOptions?: SendOptionsType,
  isPartialSend?: boolean
): Promise<CallbackResultType> {
  assert(
    window.textsecure.messaging,
    'sendToGroup: textsecure.messaging not available!'
  );

  const { timestamp } = groupSendOptions;
  const recipients = getRecipients(groupSendOptions);

  // First, do the attachment upload and prepare the proto we'll be sending
  const protoAttributes = window.textsecure.messaging.getAttrsFromGroupOptions(
    groupSendOptions
  );
  const contentMessage = await window.textsecure.messaging.getContentMessage(
    protoAttributes
  );

  return sendContentMessageToGroup({
    contentHint,
    contentMessage,
    conversation,
    isPartialSend,
    recipients,
    sendOptions,
    timestamp,
  });
}

export async function sendContentMessageToGroup({
  contentHint,
  contentMessage,
  conversation,
  isPartialSend,
  online,
  recipients,
  sendOptions,
  timestamp,
}: {
  contentHint: number;
  contentMessage: ContentClass;
  conversation: ConversationModel;
  isPartialSend?: boolean;
  online?: boolean;
  recipients: Array<string>;
  sendOptions?: SendOptionsType;
  timestamp: number;
}): Promise<CallbackResultType> {
  const logId = conversation.idForLogging();
  assert(
    window.textsecure.messaging,
    'sendContentMessageToGroup: textsecure.messaging not available!'
  );

  const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
  const ourConversation = window.ConversationController.get(ourConversationId);

  if (
    ourConversation?.get('capabilities')?.senderKey &&
    conversation.isGroupV2()
  ) {
    try {
      return await sendToGroupViaSenderKey({
        contentHint,
        contentMessage,
        conversation,
        isPartialSend,
        online,
        recipients,
        recursionCount: 0,
        sendOptions,
        timestamp,
      });
    } catch (error) {
      window.log.error(
        `sendToGroup/${logId}: Sender Key send failed, logging, proceeding to normal send`,
        error && error.stack ? error.stack : error
      );
    }
  }

  const groupId = conversation.isGroupV2()
    ? conversation.get('groupId')
    : undefined;
  return window.textsecure.messaging.sendGroupProto(
    recipients,
    contentMessage,
    timestamp,
    contentHint,
    groupId,
    sendOptions
  );
}

// The Primary Sender Key workflow

export async function sendToGroupViaSenderKey(options: {
  contentHint: number;
  contentMessage: ContentClass;
  conversation: ConversationModel;
  isPartialSend?: boolean;
  online?: boolean;
  recipients: Array<string>;
  recursionCount: number;
  sendOptions?: SendOptionsType;
  timestamp: number;
}): Promise<CallbackResultType> {
  const {
    contentHint,
    contentMessage,
    conversation,
    isPartialSend,
    online,
    recursionCount,
    recipients,
    sendOptions,
    timestamp,
  } = options;
  const {
    ContentHint,
  } = window.textsecure.protobuf.UnidentifiedSenderMessage.Message;

  const logId = conversation.idForLogging();
  window.log.info(
    `sendToGroupViaSenderKey/${logId}: Starting ${timestamp}, recursion count ${recursionCount}...`
  );

  if (recursionCount > MAX_RECURSION) {
    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Too much recursion! Count is at ${recursionCount}`
    );
  }

  const groupId = conversation.get('groupId');
  if (!groupId || !conversation.isGroupV2()) {
    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Missing groupId or group is not GV2`
    );
  }

  if (
    contentHint !== ContentHint.RESENDABLE &&
    contentHint !== ContentHint.SUPPLEMENTARY
  ) {
    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Invalid contentHint ${contentHint}`
    );
  }

  assert(
    window.textsecure.messaging,
    'sendToGroupViaSenderKey: textsecure.messaging not available!'
  );

  const {
    attributes,
  }: { attributes: ConversationAttributesType } = conversation;

  // 1. Add sender key info if we have none, or clear out if it's too old
  const THIRTY_DAYS = 30 * DAY;
  if (!attributes.senderKeyInfo) {
    window.log.info(
      `sendToGroupViaSenderKey/${logId}: Adding initial sender key info`
    );
    conversation.set({
      senderKeyInfo: {
        createdAtDate: Date.now(),
        distributionId: window.getGuid(),
        memberDevices: [],
      },
    });
    await window.Signal.Data.updateConversation(attributes);
  } else if (isOlderThan(attributes.senderKeyInfo.createdAtDate, THIRTY_DAYS)) {
    const { createdAtDate } = attributes.senderKeyInfo;
    window.log.info(
      `sendToGroupViaSenderKey/${logId}: Resetting sender key; ${createdAtDate} is too old`
    );
    await resetSenderKey(conversation);
  }

  // 2. Fetch all devices we believe we'll be sending to
  const {
    devices: currentDevices,
    emptyIdentifiers,
  } = await window.textsecure.storage.protocol.getOpenDevices(recipients);

  // 3. If we have no open sessions with people we believe we are sending to, and we
  //   believe that any have signal accounts, fetch their prekey bundle and start
  //   sessions with them.
  if (
    emptyIdentifiers.length > 0 &&
    emptyIdentifiers.some(isIdentifierRegistered)
  ) {
    await fetchKeysForIdentifiers(emptyIdentifiers);

    // Restart here to capture devices for accounts we just started sesions with
    return sendToGroupViaSenderKey({
      ...options,
      recursionCount: recursionCount + 1,
    });
  }

  assert(
    attributes.senderKeyInfo,
    `sendToGroupViaSenderKey/${logId}: expect senderKeyInfo`
  );
  // Note: From here on, we will need to recurse if we change senderKeyInfo
  const {
    memberDevices,
    distributionId,
    createdAtDate,
  } = attributes.senderKeyInfo;

  // 4. Partition devices into sender key and non-sender key groups
  const [devicesForSenderKey, devicesForNormalSend] = partition(
    currentDevices,
    device => isValidSenderKeyRecipient(conversation, device.identifier)
  );
  window.log.info(
    `sendToGroupViaSenderKey/${logId}: ${devicesForSenderKey.length} devices for sender key, ${devicesForNormalSend.length} devices for normal send`
  );

  // 5. Ensure we have enough recipients
  const senderKeyRecipients = getUuidsFromDevices(devicesForSenderKey);
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
    uuid => !conversation.hasMember(uuid)
  );
  if (keyNeedsReset) {
    await resetSenderKey(conversation);

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
    window.log.info(
      `sendToGroupViaSenderKey/${logId}: Sending sender key to ${
        newToMemberUuids.length
      } members: ${JSON.stringify(newToMemberUuids)}`
    );
    await window.textsecure.messaging.sendSenderKeyDistributionMessage(
      {
        contentHint: ContentHint.SUPPLEMENTARY,
        distributionId,
        groupId,
        identifiers: newToMemberUuids,
      },
      sendOptions
    );
  }

  // 9. Update memberDevices with both adds and the removals which didn't require a reset.
  if (removedFromMemberDevices.length > 0 || newToMemberDevices.length > 0) {
    const updatedMemberDevices = [
      ...differenceWith<DeviceType, DeviceType>(
        memberDevices,
        removedFromMemberDevices,
        deviceComparator
      ),
      ...newToMemberDevices,
    ];

    conversation.set({
      senderKeyInfo: {
        createdAtDate,
        distributionId,
        memberDevices: updatedMemberDevices,
      },
    });
    await window.Signal.Data.updateConversation(conversation.attributes);
  }

  // 10. Send the Sender Key message!
  try {
    const messageBuffer = await encryptForSenderKey({
      contentHint,
      devices: devicesForSenderKey,
      distributionId,
      contentMessage: contentMessage.toArrayBuffer(),
      groupId,
    });
    const accessKeys = getXorOfAccessKeys(devicesForSenderKey);

    const result = await window.textsecure.messaging.sendWithSenderKey(
      messageBuffer,
      accessKeys,
      timestamp,
      online
    );

    const parsed = multiRecipient200ResponseSchema.safeParse(result);
    if (parsed.success) {
      const { uuids404 } = parsed.data;
      if (uuids404 && uuids404.length > 0) {
        await _waitForAll({
          tasks: uuids404.map(uuid => async () =>
            markIdentifierUnregistered(uuid)
          ),
        });
      }
    } else {
      window.log.error(
        `sendToGroupViaSenderKey/${logId}: Server returned unexpected 200 response ${JSON.stringify(
          parsed.error.flatten()
        )}`
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
      await handle410Response(conversation, error);

      // Restart here to use the right registrationIds for devices we already knew about,
      //   as well as send our sender key to these re-registered or re-linked devices.
      return sendToGroupViaSenderKey({
        ...options,
        recursionCount: recursionCount + 1,
      });
    }

    throw new Error(
      `sendToGroupViaSenderKey/${logId}: Returned unexpected error ${error.code}. Failing over.`
    );
  }

  // 11. Return early if there are no normal send recipients
  const normalRecipients = getUuidsFromDevices(devicesForNormalSend);
  if (normalRecipients.length === 0) {
    return {
      dataMessage: contentMessage.dataMessage?.toArrayBuffer(),
      successfulIdentifiers: senderKeyRecipients,
      unidentifiedDeliveries: senderKeyRecipients,
    };
  }

  // 12. Send normal message to the leftover normal recipients. Then combine normal send
  //    result with result from sender key send for final return value.
  const normalSendResult = await window.textsecure.messaging.sendGroupProto(
    normalRecipients,
    contentMessage,
    timestamp,
    contentHint,
    groupId,
    sendOptions
  );

  return {
    dataMessage: contentMessage.dataMessage?.toArrayBuffer(),
    errors: normalSendResult.errors,
    failoverIdentifiers: normalSendResult.failoverIdentifiers,
    successfulIdentifiers: [
      ...(normalSendResult.successfulIdentifiers || []),
      ...senderKeyRecipients,
    ],
    unidentifiedDeliveries: [
      ...(normalSendResult.unidentifiedDeliveries || []),
      ...senderKeyRecipients,
    ],
  };
}

// Utility Methods

export async function _waitForAll<T>({
  tasks,
  maxConcurrency = MAX_CONCURRENCY,
}: {
  tasks: Array<() => Promise<T>>;
  maxConcurrency?: number;
}): Promise<Array<T>> {
  const queue = new PQueue({
    concurrency: maxConcurrency,
    timeout: 2 * 60 * 1000,
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
  await window.Signal.Data.saveConversation(conversation.attributes);

  await window.textsecure.storage.protocol.archiveAllSessions(identifier);
}

function isIdentifierRegistered(identifier: string) {
  const conversation = window.ConversationController.getOrCreate(
    identifier,
    'private'
  );
  const isUnregistered = conversation.isUnregistered();

  return !isUnregistered;
}

async function handle409Response(logId: string, error: Error) {
  const parsed = multiRecipient409ResponseSchema.safeParse(error.response);
  if (parsed.success) {
    await _waitForAll({
      tasks: parsed.data.map(item => async () => {
        const { uuid, devices } = item;
        // Start new sessions with devices we didn't know about before
        if (devices.missingDevices && devices.missingDevices.length > 0) {
          await fetchKeysForIdentifier(uuid, devices.extraDevices);
        }

        // Archive sessions with devices that have been removed
        if (devices.extraDevices && devices.extraDevices.length > 0) {
          await _waitForAll({
            tasks: devices.extraDevices.map(deviceId => async () => {
              const address = `${uuid}.${deviceId}`;
              await window.textsecure.storage.protocol.archiveSession(address);
            }),
          });
        }
      }),
      maxConcurrency: 2,
    });
  } else {
    window.log.error(
      `handle409Response/${logId}: Server returned unexpected 409 response ${JSON.stringify(
        parsed.error.flatten()
      )}`
    );
    throw error;
  }
}

async function handle410Response(
  conversation: ConversationModel,
  error: Error
) {
  const logId = conversation.idForLogging();

  const parsed = multiRecipient410ResponseSchema.safeParse(error.response);
  if (parsed.success) {
    await _waitForAll({
      tasks: parsed.data.map(item => async () => {
        const { uuid, devices } = item;
        if (devices.staleDevices && devices.staleDevices.length > 0) {
          // First, archive our existing sessions with these devices
          await _waitForAll({
            tasks: devices.staleDevices.map(deviceId => async () => {
              const address = `${uuid}.${deviceId}`;
              await window.textsecure.storage.protocol.archiveSession(address);
            }),
          });

          // Start new sessions with these devices
          await fetchKeysForIdentifier(uuid, devices.staleDevices);

          // Forget that we've sent our sender key to these devices, since they've
          //   been re-registered or re-linked.
          const senderKeyInfo = conversation.get('senderKeyInfo');
          if (senderKeyInfo) {
            const devicesToRemove: Array<DeviceType> = devices.staleDevices.map(
              id => ({ id, identifier: uuid })
            );
            conversation.set({
              senderKeyInfo: {
                ...senderKeyInfo,
                memberDevices: differenceWith(
                  senderKeyInfo.memberDevices,
                  devicesToRemove,
                  deviceComparator
                ),
              },
            });
            await window.Signal.Data.updateConversation(
              conversation.attributes
            );
          }
        }
      }),
      maxConcurrency: 2,
    });
  } else {
    window.log.error(
      `handle410Response/${logId}: Server returned unexpected 410 response ${JSON.stringify(
        parsed.error.flatten()
      )}`
    );
    throw error;
  }
}

function getXorOfAccessKeys(devices: Array<DeviceType>): Buffer {
  const ACCESS_KEY_LENGTH = 16;
  const uuids = getUuidsFromDevices(devices);

  const result = Buffer.alloc(ACCESS_KEY_LENGTH);
  assert(
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
  contentMessage: ArrayBuffer;
  devices: Array<DeviceType>;
  distributionId: string;
  groupId: string;
}): Promise<Buffer> {
  const ourUuid = window.textsecure.storage.user.getUuid();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();
  if (!ourUuid || !ourDeviceId) {
    throw new Error(
      'encryptForSenderKey: Unable to fetch our uuid or deviceId'
    );
  }

  const sender = ProtocolAddress.new(
    ourUuid,
    parseIntOrThrow(ourDeviceId, 'encryptForSenderKey, ourDeviceId')
  );
  const ourAddress = getOurAddress();
  const senderKeyStore = new SenderKeys();
  const message = Buffer.from(padMessage(contentMessage));

  const ciphertextMessage = await window.textsecure.storage.protocol.enqueueSenderKeyJob(
    ourAddress,
    () => groupEncrypt(sender, distributionId, senderKeyStore, message)
  );

  const groupIdBuffer = Buffer.from(groupId, 'base64');
  const senderCertificateObject = await senderCertificateService.get(
    SenderCertificateMode.WithoutE164
  );
  if (!senderCertificateObject) {
    throw new Error('encryptForSenderKey: Unable to fetch sender certifiate!');
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

  const recipients = devices.map(device =>
    ProtocolAddress.new(device.identifier, device.id)
  );
  const identityKeyStore = new IdentityKeys();
  const sessionStore = new Sessions();
  return sealedSenderMultiRecipientEncrypt(
    content,
    recipients,
    identityKeyStore,
    sessionStore
  );
}

function isValidSenderKeyRecipient(
  conversation: ConversationModel,
  uuid: string
): boolean {
  if (!conversation.hasMember(uuid)) {
    window.log.info(
      `isValidSenderKeyRecipient: Sending to ${uuid}, not a group member`
    );
    return false;
  }

  const memberConversation = window.ConversationController.get(uuid);
  if (!memberConversation) {
    window.log.warn(
      `isValidSenderKeyRecipient: Missing conversation model for member ${uuid}`
    );
    return false;
  }

  const capabilities = memberConversation.get('capabilities');
  if (!capabilities?.senderKey) {
    window.log.info(
      `isValidSenderKeyRecipient: Missing senderKey capability for member ${uuid}`
    );
    return false;
  }

  if (!getAccessKey(memberConversation.attributes)) {
    window.log.warn(
      `isValidSenderKeyRecipient: Missing accessKey for member ${uuid}`
    );
    return false;
  }

  if (memberConversation.isUnregistered()) {
    window.log.warn(
      `isValidSenderKeyRecipient: Member ${uuid} is unregistered`
    );
    return false;
  }

  return true;
}

function deviceComparator(left?: DeviceType, right?: DeviceType): boolean {
  return Boolean(
    left &&
      right &&
      left.id === right.id &&
      left.identifier === right.identifier
  );
}

function getUuidsFromDevices(devices: Array<DeviceType>): Array<string> {
  const uuids = new Set<string>();
  devices.forEach(device => {
    uuids.add(device.identifier);
  });

  return Array.from(uuids);
}

export function _analyzeSenderKeyDevices(
  memberDevices: Array<DeviceType>,
  devicesForSend: Array<DeviceType>,
  isPartialSend?: boolean
): {
  newToMemberDevices: Array<DeviceType>;
  newToMemberUuids: Array<string>;
  removedFromMemberDevices: Array<DeviceType>;
  removedFromMemberUuids: Array<string>;
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

function getOurAddress(): string {
  const ourUuid = window.textsecure.storage.user.getUuid();
  const ourDeviceId = window.textsecure.storage.user.getDeviceId();
  if (!ourUuid || !ourDeviceId) {
    throw new Error('getOurAddress: Unable to fetch our uuid or deviceId');
  }
  return `${ourUuid}.${ourDeviceId}`;
}

async function resetSenderKey(conversation: ConversationModel): Promise<void> {
  const logId = conversation.idForLogging();

  window.log.info(
    `resetSenderKey/${logId}: Sender key needs reset. Clearing data...`
  );
  const {
    attributes,
  }: { attributes: ConversationAttributesType } = conversation;
  const { senderKeyInfo } = attributes;
  if (!senderKeyInfo) {
    window.log.warn(`resetSenderKey/${logId}: No sender key info`);
    return;
  }

  const { distributionId } = senderKeyInfo;
  const address = getOurAddress();

  await window.textsecure.storage.protocol.removeSenderKey(
    address,
    distributionId
  );

  // Note: We preserve existing distributionId to minimize space for sender key storage
  conversation.set({
    senderKeyInfo: {
      createdAtDate: Date.now(),
      distributionId,
      memberDevices: [],
    },
  });
  await window.Signal.Data.saveConversation(conversation.attributes);
}

function getAccessKey(
  attributes: ConversationAttributesType
): string | undefined {
  const { sealedSender, accessKey } = attributes;

  if (
    sealedSender === SEALED_SENDER.ENABLED ||
    sealedSender === SEALED_SENDER.UNKNOWN
  ) {
    return accessKey || undefined;
  }

  return undefined;
}

async function fetchKeysForIdentifiers(
  identifiers: Array<string>
): Promise<void> {
  window.log.info(
    `fetchKeysForIdentifiers: Fetching keys for ${identifiers.length} identifiers`
  );

  try {
    await _waitForAll({
      tasks: identifiers.map(identifier => async () =>
        fetchKeysForIdentifier(identifier)
      ),
    });
  } catch (error) {
    window.log.error(
      'fetchKeysForIdentifiers: Failed to fetch keys:',
      error && error.stack ? error.stack : error
    );
  }
}

async function fetchKeysForIdentifier(
  identifier: string,
  devices?: Array<number>
): Promise<void> {
  window.log.info(
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
      window.log.info(
        `fetchKeysForIdentifiers: Setting sealedSender to DISABLED for conversation ${emptyConversation.idForLogging()}`
      );
      emptyConversation.set({
        sealedSender: SEALED_SENDER.DISABLED,
      });
      await window.Signal.Data.saveConversation(emptyConversation.attributes);
    }
  } catch (error) {
    if (error.name === 'UnregisteredUserError') {
      await markIdentifierUnregistered(identifier);
      return;
    }
    throw error;
  }
}
