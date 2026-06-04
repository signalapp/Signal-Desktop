// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { z } from 'zod';
import type { CiphertextMessage } from '@signalapp/libsignal-client';
import {
  ErrorCode,
  LibSignalErrorBase,
  CiphertextMessageType,
  PlaintextContent,
  ProtocolAddress,
  sealedSenderEncrypt,
  SenderCertificate,
  signalEncrypt,
  UnidentifiedSenderMessageContent,
} from '@signalapp/libsignal-client';
import { GroupSendFullToken } from '@signalapp/libsignal-client/zkgroup.js';

import {
  sendMessagesLegacy,
  sendMessagesUnauthLegacy,
  getKeysForServiceId as doGetKeysForServiceId,
  getKeysForServiceIdUnauth,
  sendUnsealedMessage,
  sendSealedSenderMessage,
  type SealedSenderAuthType,
} from './WebAPI.preload.ts';
import type {
  SendMetadataType,
  SendOptionsType,
} from './SendMessage.preload.ts';
import {
  OutgoingIdentityKeyError,
  MismatchedDevicesError,
  UnauthorizedMessageSendError,
  OutgoingMessageError,
} from './Errors.std.ts';
import type { CallbackResultType, CustomError } from './Types.d.ts';
import { Address } from '../types/Address.std.ts';
import { QualifiedAddress } from '../types/QualifiedAddress.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import { Sessions, IdentityKeys } from '../LibSignalStores.node.ts';
import { getKeysForServiceId } from './getKeysForServiceId.preload.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { createLogger } from '../logging/log.std.ts';
import type { GroupSendToken } from '../types/GroupSendEndorsements.std.ts';
import { isSignalServiceId } from '../util/isSignalConversation.dom.ts';
import * as Bytes from '../Bytes.std.ts';
import { signalProtocolStore } from '../SignalProtocolStore.preload.ts';
import { itemStorage } from './Storage.preload.ts';
import { isFeaturedEnabledNoRedux } from '../util/isFeatureEnabled.dom.ts';
import {
  type SingleOutboundSealedSenderMessage,
  type SingleOutboundUnsealedMessage,
} from '@signalapp/libsignal-client/dist/net/chat/SingleOutboundMessage';
import { handleMismatchedDevicesError } from '../util/handleMismatchedDevicesError.preload.ts';
import { strictAssert } from '../util/assert.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { ZERO_ACCESS_KEY } from '../types/SealedSender.std.ts';

const { reject } = lodash;

const log = createLogger('OutgoingMessage');

export const enum SenderCertificateMode {
  WithE164,
  WithoutE164,
}

export type SendLogCallbackType = (options: {
  serviceId: ServiceIdString;
  deviceIds: Array<number>;
}) => Promise<void>;

export const serializedCertificateSchema = z.object({
  expires: z.number().optional(),
  serialized: z.instanceof(Uint8Array),
});

export type SerializedCertificateType = z.infer<
  typeof serializedCertificateSchema
>;

// TODO: DESKTOP-10214 type can be excluded
type OutgoingUnsealedMessageType = {
  type: Exclude<Proto.Envelope.Type, Proto.Envelope.Type.UNIDENTIFIED_SENDER>;
} & SingleOutboundUnsealedMessage;

type OutgoingSealedSenderMessageType = {
  type: Proto.Envelope.Type.UNIDENTIFIED_SENDER;
} & SingleOutboundSealedSenderMessage;

export type OutgoingMessageType =
  | OutgoingUnsealedMessageType
  | OutgoingSealedSenderMessageType;

type OutgoingMessageOptionsType = SendOptionsType & {
  online?: boolean;
};

function ciphertextMessageTypeToEnvelopeType(type: number) {
  if (type === CiphertextMessageType.PreKey) {
    return Proto.Envelope.Type.PREKEY_MESSAGE;
  }
  if (type === CiphertextMessageType.Whisper) {
    return Proto.Envelope.Type.DOUBLE_RATCHET;
  }
  if (type === CiphertextMessageType.Plaintext) {
    return Proto.Envelope.Type.PLAINTEXT_CONTENT;
  }
  throw new Error(
    `ciphertextMessageTypeToEnvelopeType: Unrecognized type ${type}`
  );
}

const PADDING_BLOCK = 80;

function getPaddedMessageLength(messageLength: number): number {
  const messageLengthWithTerminator = messageLength + 1;
  let messagePartCount = Math.floor(
    messageLengthWithTerminator / PADDING_BLOCK
  );

  if (messageLengthWithTerminator % PADDING_BLOCK !== 0) {
    messagePartCount += 1;
  }

  return messagePartCount * PADDING_BLOCK;
}

export function padMessage(
  messageBuffer: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> {
  const plaintext = new Uint8Array(
    getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
  );
  plaintext.set(messageBuffer);
  plaintext[messageBuffer.byteLength] = 0x80;

  return plaintext;
}

export default class OutgoingMessage {
  timestamp: number;

  serviceIds: ReadonlyArray<ServiceIdString>;

  message: Proto.Content.Params | PlaintextContent;

  callback: (result: CallbackResultType) => void;

  plaintext?: Uint8Array<ArrayBuffer>;

  serviceIdsCompleted: number;

  errors: Array<CustomError>;

  successfulServiceIds: Array<ServiceIdString>;

  failoverServiceIds: Array<ServiceIdString>;

  unidentifiedDeliveries: Array<ServiceIdString>;

  sendMetadata?: SendMetadataType;

  online?: boolean;

  groupId?: string;

  contentHint: number;

  urgent: boolean;

  story?: boolean;

  recipients: Record<string, Array<number>>;

  sendLogCallback?: SendLogCallbackType;

  constructor({
    callback,
    contentHint,
    groupId,
    serviceIds,
    message,
    options,
    sendLogCallback,
    story,
    timestamp,
    urgent,
  }: {
    callback: (result: CallbackResultType) => void;
    contentHint: number;
    groupId: string | undefined;
    serviceIds: ReadonlyArray<ServiceIdString>;
    message: Proto.Content.Params | PlaintextContent;
    options?: OutgoingMessageOptionsType;
    sendLogCallback?: SendLogCallbackType;
    story?: boolean;
    timestamp: number;
    urgent: boolean;
  }) {
    this.message = message;

    this.timestamp = timestamp;
    this.serviceIds = serviceIds;
    this.contentHint = contentHint;
    this.groupId = groupId;
    this.callback = callback;
    this.story = story;
    this.urgent = urgent;

    this.serviceIdsCompleted = 0;
    this.errors = [];
    this.successfulServiceIds = [];
    this.failoverServiceIds = [];
    this.unidentifiedDeliveries = [];
    this.recipients = {};
    this.sendLogCallback = sendLogCallback;

    this.sendMetadata = options?.sendMetadata;
    this.online = options?.online;
  }

  numberCompleted(): void {
    this.serviceIdsCompleted += 1;
    if (this.serviceIdsCompleted >= this.serviceIds.length) {
      const proto = this.message;
      const contentProto = this.getContentProtoBytes();
      const { timestamp, contentHint, recipients, urgent } = this;
      let dataMessage: Uint8Array<ArrayBuffer> | undefined;
      let editMessage: Uint8Array<ArrayBuffer> | undefined;
      let hasPniSignatureMessage = false;

      if (!(proto instanceof PlaintextContent)) {
        if (proto.content?.dataMessage) {
          dataMessage = Proto.DataMessage.encode(proto.content.dataMessage);
        } else if (proto.content?.editMessage) {
          editMessage = Proto.EditMessage.encode(proto.content.editMessage);
        }
        hasPniSignatureMessage = Boolean(proto.pniSignatureMessage);
      }

      this.callback({
        successfulServiceIds: this.successfulServiceIds,
        failoverServiceIds: this.failoverServiceIds,
        errors: this.errors,
        unidentifiedDeliveries: this.unidentifiedDeliveries,

        contentHint,
        dataMessage,
        editMessage,
        recipients,
        contentProto,
        timestamp,
        urgent,
        hasPniSignatureMessage,
      });
    }
  }

  registerError(
    serviceId: ServiceIdString,
    reason: string,
    providedError?: Error
  ): void {
    const error =
      providedError ?? new OutgoingMessageError(serviceId, providedError);

    error.cause = reason;

    this.errors[this.errors.length] = error;
    this.numberCompleted();
  }

  reloadDevicesAndSend(
    serviceId: ServiceIdString,
    recurse?: boolean
  ): () => Promise<void> {
    return async () => {
      const ourAci = itemStorage.user.getCheckedAci();
      const deviceIds = await signalProtocolStore.getDeviceIds({
        ourServiceId: ourAci,
        serviceId,
      });
      if (deviceIds.length === 0) {
        this.registerError(
          serviceId,
          'reloadDevicesAndSend: Got empty device list when loading device keys',
          undefined
        );
        return undefined;
      }
      return this.doSendMessage(serviceId, deviceIds, recurse);
    };
  }

  async getKeysForServiceId(
    serviceId: ServiceIdString,
    updateDevices: Array<number> | null
  ): Promise<void> {
    const { sendMetadata } = this;
    const info =
      sendMetadata && sendMetadata[serviceId]
        ? sendMetadata[serviceId]
        : { accessKey: null };
    const { accessKey } = info;

    const { accessKeyFailed } = await getKeysForServiceId(
      serviceId,
      { getKeysForServiceId: doGetKeysForServiceId, getKeysForServiceIdUnauth },
      updateDevices ?? null,
      accessKey,
      null
    );
    if (accessKeyFailed && !this.failoverServiceIds.includes(serviceId)) {
      this.failoverServiceIds.push(serviceId);
    }
  }

  async transmitSealedSenderMessage(
    serviceId: ServiceIdString,
    messages: ReadonlyArray<OutgoingSealedSenderMessageType>,
    timestamp: number,
    {
      accessKey,
      groupSendToken,
    }: {
      accessKey: string | null;
      groupSendToken: GroupSendToken | null;
    } = { accessKey: null, groupSendToken: null }
  ): Promise<void> {
    const useLibsignal = isFeaturedEnabledNoRedux({
      betaKey: 'desktop.sendMessageViaLibsignal.beta',
      prodKey: 'desktop.sendMessageViaLibsignal.prod',
    });

    if (useLibsignal) {
      let auth: SealedSenderAuthType;
      if (this.story) {
        auth = 'story';
      } else if (groupSendToken) {
        auth = new GroupSendFullToken(groupSendToken);
      } else if (accessKey) {
        if (accessKey === ZERO_ACCESS_KEY) {
          auth = 'unrestricted';
        } else {
          auth = { accessKey: Bytes.fromBase64(accessKey) };
        }
      } else {
        auth = 'unrestricted';
      }

      return sendSealedSenderMessage(serviceId, messages, timestamp, auth, {
        online: this.online,
        urgent: this.urgent,
      });
    }

    return sendMessagesUnauthLegacy(serviceId, messages, timestamp, {
      accessKey,
      groupSendToken,
      online: this.online,
      story: this.story,
      urgent: this.urgent,
    });
  }

  async transmitUnsealedMessage(
    serviceId: ServiceIdString,
    messages: ReadonlyArray<OutgoingUnsealedMessageType>,
    timestamp: number
  ): Promise<void> {
    const useLibsignal = isFeaturedEnabledNoRedux({
      betaKey: 'desktop.sendMessageViaLibsignal.beta',
      prodKey: 'desktop.sendMessageViaLibsignal.prod',
    });

    if (useLibsignal) {
      return sendUnsealedMessage(serviceId, messages, timestamp, {
        online: this.online,
        urgent: this.urgent,
        ourAci: itemStorage.user.getCheckedAci(),
      });
    }

    return sendMessagesLegacy(serviceId, messages, timestamp, {
      online: this.online,
      story: this.story,
      urgent: this.urgent,
    });
  }

  getPlaintext(): Uint8Array<ArrayBuffer> {
    if (!this.plaintext) {
      const { message } = this;

      if (message instanceof PlaintextContent) {
        this.plaintext = message.serialize();
      } else {
        this.plaintext = padMessage(Proto.Content.encode(message));
      }
    }
    return this.plaintext;
  }

  getContentProtoBytes(): Uint8Array<ArrayBuffer> | undefined {
    if (this.message instanceof PlaintextContent) {
      return undefined;
    }

    return Proto.Content.encode(this.message);
  }

  async getCiphertextMessage({
    identityKeyStore,
    destinationAddress,
    localAddress,
    sessionStore,
  }: {
    identityKeyStore: IdentityKeys;
    destinationAddress: ProtocolAddress;
    localAddress: ProtocolAddress;
    sessionStore: Sessions;
  }): Promise<CiphertextMessage> {
    const { message } = this;

    if (message instanceof PlaintextContent) {
      return message.asCiphertextMessage();
    }

    return signalEncrypt(
      this.getPlaintext(),
      destinationAddress,
      localAddress,
      sessionStore,
      identityKeyStore
    );
  }

  async doSendMessage(
    serviceId: ServiceIdString,
    deviceIds: Array<number>,
    recurse?: boolean
  ): Promise<void> {
    const { sendMetadata } = this;
    const {
      accessKey = null,
      groupSendToken = null,
      senderCertificate,
    } = sendMetadata?.[serviceId] || {};

    if (accessKey && !senderCertificate) {
      log.warn(
        'doSendMessage: accessKey was provided, but senderCertificate was not'
      );
    }

    const sealedSender =
      (accessKey != null || groupSendToken != null) &&
      senderCertificate != null;

    // We don't send to ourselves unless sealedSender is enabled
    const ourNumber = itemStorage.user.getNumber();
    const ourAci = itemStorage.user.getCheckedAci();
    const ourDeviceId = itemStorage.user.getCheckedDeviceId();
    if ((serviceId === ourNumber || serviceId === ourAci) && !sealedSender) {
      // oxlint-disable-next-line no-param-reassign
      deviceIds = reject(
        deviceIds,
        deviceId =>
          // because we store our own device ID as a string at least sometimes
          deviceId === ourDeviceId ||
          (typeof ourDeviceId === 'string' &&
            deviceId === parseInt(ourDeviceId, 10))
      );
    }

    const sessionStore = new Sessions({
      signalProtocolStore,
      ourServiceId: ourAci,
    });
    const identityKeyStore = new IdentityKeys({
      signalProtocolStore,
      ourServiceId: ourAci,
    });
    const localAddress = ProtocolAddress.new(ourAci, ourDeviceId);

    return (
      Promise.all(
        deviceIds.map(async deviceId => {
          const address = new QualifiedAddress(
            ourAci,
            new Address(serviceId, deviceId)
          );

          return signalProtocolStore.enqueueSessionJob<OutgoingMessageType>(
            address,
            async () => {
              const destinationAddress = ProtocolAddress.new(
                serviceId,
                deviceId
              );

              const activeSession =
                await sessionStore.getSession(destinationAddress);
              if (!activeSession) {
                throw new Error(
                  'OutgoingMessage.doSendMessage: No active session!'
                );
              }

              const registrationId = activeSession.remoteRegistrationId();

              if (sealedSender && senderCertificate) {
                const ciphertextMessage = await this.getCiphertextMessage({
                  identityKeyStore,
                  destinationAddress,
                  localAddress,
                  sessionStore,
                });

                const certificate = SenderCertificate.deserialize(
                  senderCertificate.serialized
                );
                const groupIdBuffer = this.groupId
                  ? Bytes.fromBase64(this.groupId)
                  : null;

                const content = UnidentifiedSenderMessageContent.new(
                  ciphertextMessage,
                  certificate,
                  this.contentHint,
                  groupIdBuffer
                );

                const buffer = await sealedSenderEncrypt(
                  content,
                  destinationAddress,
                  identityKeyStore
                );

                return {
                  type: Proto.Envelope.Type.UNIDENTIFIED_SENDER,
                  deviceId,
                  registrationId,
                  contents: buffer,
                };
              }

              const ciphertextMessage = await this.getCiphertextMessage({
                identityKeyStore,
                destinationAddress,
                localAddress,
                sessionStore,
              });
              const type = ciphertextMessageTypeToEnvelopeType(
                ciphertextMessage.type()
              );

              return {
                type,
                deviceId,
                registrationId,
                contents: ciphertextMessage,
              };
            }
          );
        })
      )
        // oxlint-disable-next-line promise/prefer-await-to-then, signal-desktop/no-then
        .then(async (ciphertextMessages: Array<OutgoingMessageType>) => {
          if (sealedSender) {
            strictAssert(
              ciphertextMessages.every(
                message =>
                  message.type === Proto.Envelope.Type.UNIDENTIFIED_SENDER
              ),
              'must be sealed sender envelopes'
            );
            return this.transmitSealedSenderMessage(
              serviceId,
              ciphertextMessages,
              this.timestamp,
              {
                accessKey,
                groupSendToken,
              }
              // oxlint-disable-next-line signal-desktop/no-then
            ).then(
              () => {
                this.recipients[serviceId] = deviceIds;
                this.unidentifiedDeliveries.push(serviceId);
                this.successfulServiceIds.push(serviceId);
                this.numberCompleted();

                if (this.sendLogCallback) {
                  void this.sendLogCallback({
                    serviceId,
                    deviceIds,
                  });
                } else if (this.successfulServiceIds.length > 1) {
                  log.warn(
                    `doSendMessage: no sendLogCallback provided for message ${this.timestamp}, but multiple recipients`
                  );
                }
              },
              async (error: Error) => {
                if (error instanceof UnauthorizedMessageSendError) {
                  log.warn(
                    `doSendMessage: Failing over to unsealed send for serviceId ${serviceId}`
                  );
                  if (!this.failoverServiceIds.includes(serviceId)) {
                    this.failoverServiceIds.push(serviceId);
                  }

                  // This ensures that we don't hit this codepath the next time through
                  if (sendMetadata) {
                    delete sendMetadata[serviceId];
                  }

                  return this.doSendMessage(serviceId, deviceIds, recurse);
                }

                throw error;
              }
            );
          }

          strictAssert(
            ciphertextMessages.every(
              message =>
                message.type !== Proto.Envelope.Type.UNIDENTIFIED_SENDER
            ),
            'cannot be sealed sender'
          );
          return this.transmitUnsealedMessage(
            serviceId,
            ciphertextMessages,
            this.timestamp
            // oxlint-disable-next-line signal-desktop/no-then
          ).then(() => {
            this.successfulServiceIds.push(serviceId);
            this.recipients[serviceId] = deviceIds;
            this.numberCompleted();

            if (this.sendLogCallback) {
              void this.sendLogCallback({
                serviceId,
                deviceIds,
              });
            } else if (this.successfulServiceIds.length > 1) {
              log.warn(
                `doSendMessage: no sendLogCallback provided for message ${this.timestamp}, but multiple recipients`
              );
            }
          });
        })
        // oxlint-disable-next-line promise/prefer-await-to-then
        .catch(async error => {
          if (error instanceof MismatchedDevicesError) {
            if (!recurse) {
              this.registerError(
                serviceId,
                'Hit retry limit attempting to reload device list',
                error
              );
              return undefined;
            }

            await handleMismatchedDevicesError(error, {
              fetchKeysForServiceId: this.getKeysForServiceId.bind(this),
              log,
              ourAci,
            });

            const entry = error.entries.at(0);

            // if we only have stale devices, we try only once more
            const shouldRecurse =
              Boolean(entry?.extraDevices?.length) ||
              Boolean(entry?.missingDevices?.length);

            return this.reloadDevicesAndSend(serviceId, shouldRecurse)();
          }

          let newError = error;
          if (
            error instanceof LibSignalErrorBase &&
            error.is(ErrorCode.UntrustedIdentity)
          ) {
            newError = new OutgoingIdentityKeyError(serviceId, error);
            log.error(
              'UntrustedIdentityKeyError from decrypt!',
              serviceId,
              deviceIds
            );

            log.info('closing all sessions for', serviceId);
            // oxlint-disable-next-line promise/prefer-await-to-then, signal-desktop/no-then
            signalProtocolStore.archiveAllSessions(serviceId).then(
              () => {
                throw error;
              },
              innerError => {
                log.error(
                  `doSendMessage: Error closing sessions: ${toLogFormat(innerError)}`
                );
                throw error;
              }
            );
          }

          this.registerError(
            serviceId,
            'Failed to create or send message',
            newError
          );

          return undefined;
        })
    );
  }

  async removeDeviceIdsForServiceId(
    serviceId: ServiceIdString,
    deviceIdsToRemove: Array<number>
  ): Promise<void> {
    const ourAci = itemStorage.user.getCheckedAci();

    await Promise.all(
      deviceIdsToRemove.map(async deviceId => {
        await signalProtocolStore.archiveSession(
          new QualifiedAddress(ourAci, new Address(serviceId, deviceId))
        );
      })
    );
  }

  async sendToServiceId(serviceId: ServiceIdString): Promise<void> {
    if (isSignalServiceId(serviceId)) {
      this.registerError(
        serviceId,
        'Failed to send to Signal serviceId',
        new Error("Can't send to Signal serviceId")
      );
      return;
    }

    try {
      const ourAci = itemStorage.user.getCheckedAci();
      const deviceIds = await signalProtocolStore.getDeviceIds({
        ourServiceId: ourAci,
        serviceId,
      });
      if (deviceIds.length === 0) {
        await this.getKeysForServiceId(serviceId, null);
      }
      await this.reloadDevicesAndSend(serviceId, true)();
    } catch (error) {
      if (
        error instanceof LibSignalErrorBase &&
        error.is(ErrorCode.UntrustedIdentity)
      ) {
        const newError = new OutgoingIdentityKeyError(serviceId, error);
        this.registerError(serviceId, 'Untrusted identity', newError);
      } else {
        this.registerError(
          serviceId,
          `Failed to retrieve new device keys for serviceId ${serviceId}`,
          error
        );
      }
    }
  }
}
