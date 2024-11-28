// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable more/no-then */
/* eslint-disable no-param-reassign */

import { reject } from 'lodash';

import { z } from 'zod';
import type {
  CiphertextMessage,
  PlaintextContent,
} from '@signalapp/libsignal-client';
import {
  ErrorCode,
  LibSignalErrorBase,
  CiphertextMessageType,
  ProtocolAddress,
  sealedSenderEncrypt,
  SenderCertificate,
  signalEncrypt,
  UnidentifiedSenderMessageContent,
} from '@signalapp/libsignal-client';

import type { WebAPIType, MessageType } from './WebAPI';
import type { SendMetadataType, SendOptionsType } from './SendMessage';
import {
  OutgoingIdentityKeyError,
  OutgoingMessageError,
  SendMessageNetworkError,
  SendMessageChallengeError,
  UnregisteredUserError,
  HTTPError,
} from './Errors';
import type { CallbackResultType, CustomError } from './Types.d';
import { Address } from '../types/Address';
import * as Errors from '../types/errors';
import { QualifiedAddress } from '../types/QualifiedAddress';
import type { ServiceIdString } from '../types/ServiceId';
import { Sessions, IdentityKeys } from '../LibSignalStores';
import { getKeysForServiceId } from './getKeysForServiceId';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import type { GroupSendToken } from '../types/GroupSendEndorsements';
import { isSignalServiceId } from '../util/isSignalConversation';

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

type OutgoingMessageOptionsType = SendOptionsType & {
  online?: boolean;
};

function ciphertextMessageTypeToEnvelopeType(type: number) {
  if (type === CiphertextMessageType.PreKey) {
    return Proto.Envelope.Type.PREKEY_BUNDLE;
  }
  if (type === CiphertextMessageType.Whisper) {
    return Proto.Envelope.Type.CIPHERTEXT;
  }
  if (type === CiphertextMessageType.Plaintext) {
    return Proto.Envelope.Type.PLAINTEXT_CONTENT;
  }
  throw new Error(
    `ciphertextMessageTypeToEnvelopeType: Unrecognized type ${type}`
  );
}

function getPaddedMessageLength(messageLength: number): number {
  const messageLengthWithTerminator = messageLength + 1;
  let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

  if (messageLengthWithTerminator % 160 !== 0) {
    messagePartCount += 1;
  }

  return messagePartCount * 160;
}

export function padMessage(messageBuffer: Uint8Array): Uint8Array {
  const plaintext = new Uint8Array(
    getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
  );
  plaintext.set(messageBuffer);
  plaintext[messageBuffer.byteLength] = 0x80;

  return plaintext;
}

export default class OutgoingMessage {
  server: WebAPIType;

  timestamp: number;

  serviceIds: ReadonlyArray<ServiceIdString>;

  message: Proto.Content | PlaintextContent;

  callback: (result: CallbackResultType) => void;

  plaintext?: Uint8Array;

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
    server,
    story,
    timestamp,
    urgent,
  }: {
    callback: (result: CallbackResultType) => void;
    contentHint: number;
    groupId: string | undefined;
    serviceIds: ReadonlyArray<ServiceIdString>;
    message: Proto.Content | Proto.DataMessage | PlaintextContent;
    options?: OutgoingMessageOptionsType;
    sendLogCallback?: SendLogCallbackType;
    server: WebAPIType;
    story?: boolean;
    timestamp: number;
    urgent: boolean;
  }) {
    if (message instanceof Proto.DataMessage) {
      const content = new Proto.Content();
      content.dataMessage = message;
      this.message = content;
    } else {
      this.message = message;
    }

    this.server = server;
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
      let dataMessage: Uint8Array | undefined;
      let editMessage: Uint8Array | undefined;
      let hasPniSignatureMessage = false;

      if (proto instanceof Proto.Content) {
        if (proto.dataMessage) {
          dataMessage = Proto.DataMessage.encode(proto.dataMessage).finish();
        } else if (proto.editMessage) {
          editMessage = Proto.EditMessage.encode(proto.editMessage).finish();
        }
        hasPniSignatureMessage = Boolean(proto.pniSignatureMessage);
      } else if (proto instanceof Proto.DataMessage) {
        dataMessage = Proto.DataMessage.encode(proto).finish();
      } else if (proto instanceof Proto.EditMessage) {
        editMessage = Proto.EditMessage.encode(proto).finish();
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
    let error = providedError;

    if (!error || (error instanceof HTTPError && error.code !== 404)) {
      if (error && error.code === 428) {
        error = new SendMessageChallengeError(serviceId, error);
      } else {
        error = new OutgoingMessageError(serviceId, null, null, error);
      }
    }

    error.cause = reason;

    this.errors[this.errors.length] = error;
    this.numberCompleted();
  }

  reloadDevicesAndSend(
    serviceId: ServiceIdString,
    recurse?: boolean
  ): () => Promise<void> {
    return async () => {
      const ourAci = window.textsecure.storage.user.getCheckedAci();
      const deviceIds = await window.textsecure.storage.protocol.getDeviceIds({
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
      this.server,
      updateDevices ?? null,
      accessKey,
      null
    );
    if (accessKeyFailed && !this.failoverServiceIds.includes(serviceId)) {
      this.failoverServiceIds.push(serviceId);
    }
  }

  async transmitMessage(
    serviceId: ServiceIdString,
    jsonData: ReadonlyArray<MessageType>,
    timestamp: number,
    {
      accessKey,
      groupSendToken,
    }: {
      accessKey: string | null;
      groupSendToken: GroupSendToken | null;
    } = { accessKey: null, groupSendToken: null }
  ): Promise<void> {
    let promise;

    if (accessKey != null || groupSendToken != null) {
      promise = this.server.sendMessagesUnauth(serviceId, jsonData, timestamp, {
        accessKey,
        groupSendToken,
        online: this.online,
        story: this.story,
        urgent: this.urgent,
      });
    } else {
      promise = this.server.sendMessages(serviceId, jsonData, timestamp, {
        online: this.online,
        story: this.story,
        urgent: this.urgent,
      });
    }

    return promise.catch(e => {
      if (e instanceof HTTPError && e.code !== 409 && e.code !== 410) {
        // 409 and 410 should bubble and be handled by doSendMessage
        // 404 should throw UnregisteredUserError
        // 428 should throw SendMessageChallengeError
        // all other network errors can be retried later.
        if (e.code === 404) {
          throw new UnregisteredUserError(serviceId, e);
        }
        if (e.code === 428) {
          throw new SendMessageChallengeError(serviceId, e);
        }
        throw new SendMessageNetworkError(serviceId, jsonData, e);
      }
      throw e;
    });
  }

  getPlaintext(): Uint8Array {
    if (!this.plaintext) {
      const { message } = this;

      if (message instanceof Proto.Content) {
        this.plaintext = padMessage(Proto.Content.encode(message).finish());
      } else {
        this.plaintext = message.serialize();
      }
    }
    return this.plaintext;
  }

  getContentProtoBytes(): Uint8Array | undefined {
    if (this.message instanceof Proto.Content) {
      return new Uint8Array(Proto.Content.encode(this.message).finish());
    }

    return undefined;
  }

  async getCiphertextMessage({
    identityKeyStore,
    protocolAddress,
    sessionStore,
  }: {
    identityKeyStore: IdentityKeys;
    protocolAddress: ProtocolAddress;
    sessionStore: Sessions;
  }): Promise<CiphertextMessage> {
    const { message } = this;

    if (message instanceof Proto.Content) {
      return signalEncrypt(
        Buffer.from(this.getPlaintext()),
        protocolAddress,
        sessionStore,
        identityKeyStore
      );
    }

    return message.asCiphertextMessage();
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
        'OutgoingMessage.doSendMessage: accessKey was provided, but senderCertificate was not'
      );
    }

    const sealedSender =
      (accessKey != null || groupSendToken != null) &&
      senderCertificate != null;

    // We don't send to ourselves unless sealedSender is enabled
    const ourNumber = window.textsecure.storage.user.getNumber();
    const ourAci = window.textsecure.storage.user.getCheckedAci();
    const ourDeviceId = window.textsecure.storage.user.getDeviceId();
    if ((serviceId === ourNumber || serviceId === ourAci) && !sealedSender) {
      deviceIds = reject(
        deviceIds,
        deviceId =>
          // because we store our own device ID as a string at least sometimes
          deviceId === ourDeviceId ||
          (typeof ourDeviceId === 'string' &&
            deviceId === parseInt(ourDeviceId, 10))
      );
    }

    const sessionStore = new Sessions({ ourServiceId: ourAci });
    const identityKeyStore = new IdentityKeys({ ourServiceId: ourAci });

    return Promise.all(
      deviceIds.map(async destinationDeviceId => {
        const address = new QualifiedAddress(
          ourAci,
          new Address(serviceId, destinationDeviceId)
        );

        return window.textsecure.storage.protocol.enqueueSessionJob<MessageType>(
          address,
          `doSendMessage(${address.toString()}, ${this.timestamp})`,
          async () => {
            const protocolAddress = ProtocolAddress.new(
              serviceId,
              destinationDeviceId
            );

            const activeSession =
              await sessionStore.getSession(protocolAddress);
            if (!activeSession) {
              throw new Error(
                'OutgoingMessage.doSendMessage: No active session!'
              );
            }

            const destinationRegistrationId =
              activeSession.remoteRegistrationId();

            if (sealedSender && senderCertificate) {
              const ciphertextMessage = await this.getCiphertextMessage({
                identityKeyStore,
                protocolAddress,
                sessionStore,
              });

              const certificate = SenderCertificate.deserialize(
                Buffer.from(senderCertificate.serialized)
              );
              const groupIdBuffer = this.groupId
                ? Buffer.from(this.groupId, 'base64')
                : null;

              const content = UnidentifiedSenderMessageContent.new(
                ciphertextMessage,
                certificate,
                this.contentHint,
                groupIdBuffer
              );

              const buffer = await sealedSenderEncrypt(
                content,
                protocolAddress,
                identityKeyStore
              );

              return {
                type: Proto.Envelope.Type.UNIDENTIFIED_SENDER,
                destinationDeviceId,
                destinationRegistrationId,
                content: buffer.toString('base64'),
              };
            }

            const ciphertextMessage = await this.getCiphertextMessage({
              identityKeyStore,
              protocolAddress,
              sessionStore,
            });
            const type = ciphertextMessageTypeToEnvelopeType(
              ciphertextMessage.type()
            );

            const content = ciphertextMessage.serialize().toString('base64');

            return {
              type,
              destinationDeviceId,
              destinationRegistrationId,
              content,
            };
          }
        );
      })
    )
      .then(async (jsonData: Array<MessageType>) => {
        if (sealedSender) {
          return this.transmitMessage(serviceId, jsonData, this.timestamp, {
            accessKey,
            groupSendToken,
          }).then(
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
                  `OutgoingMessage.doSendMessage: no sendLogCallback provided for message ${this.timestamp}, but multiple recipients`
                );
              }
            },
            async (error: Error) => {
              if (
                error instanceof SendMessageNetworkError &&
                (error.code === 401 || error.code === 403)
              ) {
                log.warn(
                  `OutgoingMessage.doSendMessage: Failing over to unsealed send for serviceId ${serviceId}`
                );
                if (this.failoverServiceIds.indexOf(serviceId) === -1) {
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

        return this.transmitMessage(serviceId, jsonData, this.timestamp).then(
          () => {
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
                `OutgoingMessage.doSendMessage: no sendLogCallback provided for message ${this.timestamp}, but multiple recipients`
              );
            }
          }
        );
      })
      .catch(async error => {
        if (
          error instanceof HTTPError &&
          (error.code === 410 || error.code === 409)
        ) {
          if (!recurse) {
            this.registerError(
              serviceId,
              'Hit retry limit attempting to reload device list',
              error
            );
            return undefined;
          }

          const response = error.response as {
            extraDevices?: Array<number>;
            staleDevices?: Array<number>;
            missingDevices?: Array<number>;
          };
          let p: Promise<any> = Promise.resolve();
          if (error.code === 409) {
            p = this.removeDeviceIdsForServiceId(
              serviceId,
              response.extraDevices || []
            );
          } else {
            p = Promise.all(
              (response.staleDevices || []).map(async (deviceId: number) => {
                await window.textsecure.storage.protocol.archiveSession(
                  new QualifiedAddress(ourAci, new Address(serviceId, deviceId))
                );
              })
            );
          }

          return p.then(async () => {
            const resetDevices =
              error.code === 410
                ? (response.staleDevices ?? null)
                : (response.missingDevices ?? null);
            return this.getKeysForServiceId(serviceId, resetDevices).then(
              // We continue to retry as long as the error code was 409; the assumption is
              //   that we'll request new device info and the next request will succeed.
              this.reloadDevicesAndSend(serviceId, error.code === 409)
            );
          });
        }

        let newError = error;
        if (
          error instanceof LibSignalErrorBase &&
          error.code === ErrorCode.UntrustedIdentity
        ) {
          newError = new OutgoingIdentityKeyError(serviceId, error);
          log.error(
            'Got "key changed" error from encrypt - no identityKey for application layer',
            serviceId,
            deviceIds
          );

          log.info('closing all sessions for', serviceId);
          window.textsecure.storage.protocol.archiveAllSessions(serviceId).then(
            () => {
              throw error;
            },
            innerError => {
              log.error(
                'doSendMessage: Error closing sessions: ' +
                  `${Errors.toLogFormat(innerError)}`
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
      });
  }

  async removeDeviceIdsForServiceId(
    serviceId: ServiceIdString,
    deviceIdsToRemove: Array<number>
  ): Promise<void> {
    const ourAci = window.textsecure.storage.user.getCheckedAci();

    await Promise.all(
      deviceIdsToRemove.map(async deviceId => {
        await window.textsecure.storage.protocol.archiveSession(
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
      const ourAci = window.textsecure.storage.user.getCheckedAci();
      const deviceIds = await window.textsecure.storage.protocol.getDeviceIds({
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
        error.code === ErrorCode.UntrustedIdentity
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
