// Copyright 2020-2022 Signal Messenger, LLC
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
import { isValidNumber } from '../types/PhoneNumber';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { UUID, isValidUuid } from '../types/UUID';
import { Sessions, IdentityKeys } from '../LibSignalStores';
import { updateConversationsWithUuidLookup } from '../updateConversationsWithUuidLookup';
import { getKeysForIdentifier } from './getKeysForIdentifier';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';

export const enum SenderCertificateMode {
  WithE164,
  WithoutE164,
}

export type SendLogCallbackType = (options: {
  identifier: string;
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

  identifiers: ReadonlyArray<string>;

  message: Proto.Content | PlaintextContent;

  callback: (result: CallbackResultType) => void;

  plaintext?: Uint8Array;

  identifiersCompleted: number;

  errors: Array<CustomError>;

  successfulIdentifiers: Array<string>;

  failoverIdentifiers: Array<string>;

  unidentifiedDeliveries: Array<string>;

  sendMetadata?: SendMetadataType;

  online?: boolean;

  groupId?: string;

  contentHint: number;

  urgent: boolean;

  recipients: Record<string, Array<number>>;

  sendLogCallback?: SendLogCallbackType;

  constructor({
    callback,
    contentHint,
    groupId,
    identifiers,
    message,
    options,
    sendLogCallback,
    server,
    timestamp,
    urgent,
  }: {
    callback: (result: CallbackResultType) => void;
    contentHint: number;
    groupId: string | undefined;
    identifiers: ReadonlyArray<string>;
    message: Proto.Content | Proto.DataMessage | PlaintextContent;
    options?: OutgoingMessageOptionsType;
    sendLogCallback?: SendLogCallbackType;
    server: WebAPIType;
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
    this.identifiers = identifiers;
    this.contentHint = contentHint;
    this.groupId = groupId;
    this.callback = callback;
    this.urgent = urgent;

    this.identifiersCompleted = 0;
    this.errors = [];
    this.successfulIdentifiers = [];
    this.failoverIdentifiers = [];
    this.unidentifiedDeliveries = [];
    this.recipients = {};
    this.sendLogCallback = sendLogCallback;

    this.sendMetadata = options?.sendMetadata;
    this.online = options?.online;
  }

  numberCompleted(): void {
    this.identifiersCompleted += 1;
    if (this.identifiersCompleted >= this.identifiers.length) {
      const proto = this.message;
      const contentProto = this.getContentProtoBytes();
      const { timestamp, contentHint, recipients, urgent } = this;
      let dataMessage: Uint8Array | undefined;

      if (proto instanceof Proto.Content && proto.dataMessage) {
        dataMessage = Proto.DataMessage.encode(proto.dataMessage).finish();
      } else if (proto instanceof Proto.DataMessage) {
        dataMessage = Proto.DataMessage.encode(proto).finish();
      }

      this.callback({
        successfulIdentifiers: this.successfulIdentifiers,
        failoverIdentifiers: this.failoverIdentifiers,
        errors: this.errors,
        unidentifiedDeliveries: this.unidentifiedDeliveries,

        contentHint,
        dataMessage,
        recipients,
        contentProto,
        timestamp,
        urgent,
      });
    }
  }

  registerError(
    identifier: string,
    reason: string,
    providedError?: Error
  ): void {
    let error = providedError;

    if (!error || (error instanceof HTTPError && error.code !== 404)) {
      if (error && error.code === 428) {
        error = new SendMessageChallengeError(identifier, error);
      } else {
        error = new OutgoingMessageError(identifier, null, null, error);
      }
    }

    error.reason = reason;
    error.stackForLog = providedError ? providedError.stack : undefined;

    this.errors[this.errors.length] = error;
    this.numberCompleted();
  }

  reloadDevicesAndSend(
    identifier: string,
    recurse?: boolean
  ): () => Promise<void> {
    return async () => {
      const ourUuid = window.textsecure.storage.user.getCheckedUuid();
      const deviceIds = await window.textsecure.storage.protocol.getDeviceIds({
        ourUuid,
        identifier,
      });
      if (deviceIds.length === 0) {
        this.registerError(
          identifier,
          'reloadDevicesAndSend: Got empty device list when loading device keys',
          undefined
        );
        return undefined;
      }
      return this.doSendMessage(identifier, deviceIds, recurse);
    };
  }

  async getKeysForIdentifier(
    identifier: string,
    updateDevices?: Array<number>
  ): Promise<void | Array<void | null>> {
    const { sendMetadata } = this;
    const info =
      sendMetadata && sendMetadata[identifier]
        ? sendMetadata[identifier]
        : { accessKey: undefined };
    const { accessKey } = info;

    try {
      const { accessKeyFailed } = await getKeysForIdentifier(
        identifier,
        this.server,
        updateDevices,
        accessKey
      );
      if (accessKeyFailed && !this.failoverIdentifiers.includes(identifier)) {
        this.failoverIdentifiers.push(identifier);
      }
    } catch (error) {
      if (error?.message?.includes('untrusted identity for address')) {
        error.timestamp = this.timestamp;
      }
      throw error;
    }
  }

  async transmitMessage(
    identifier: string,
    jsonData: ReadonlyArray<MessageType>,
    timestamp: number,
    { accessKey }: { accessKey?: string } = {}
  ): Promise<void> {
    let promise;

    if (accessKey) {
      promise = this.server.sendMessagesUnauth(
        identifier,
        jsonData,
        timestamp,
        { accessKey, online: this.online, urgent: this.urgent }
      );
    } else {
      promise = this.server.sendMessages(identifier, jsonData, timestamp, {
        online: this.online,
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
          throw new UnregisteredUserError(identifier, e);
        }
        if (e.code === 428) {
          throw new SendMessageChallengeError(identifier, e);
        }
        throw new SendMessageNetworkError(identifier, jsonData, e);
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
    identifier: string,
    deviceIds: Array<number>,
    recurse?: boolean
  ): Promise<void> {
    const { sendMetadata } = this;
    const { accessKey, senderCertificate } = sendMetadata?.[identifier] || {};

    if (accessKey && !senderCertificate) {
      log.warn(
        'OutgoingMessage.doSendMessage: accessKey was provided, but senderCertificate was not'
      );
    }

    const sealedSender = Boolean(accessKey && senderCertificate);

    // We don't send to ourselves unless sealedSender is enabled
    const ourNumber = window.textsecure.storage.user.getNumber();
    const ourUuid = window.textsecure.storage.user.getCheckedUuid();
    const ourDeviceId = window.textsecure.storage.user.getDeviceId();
    if (
      (identifier === ourNumber || identifier === ourUuid.toString()) &&
      !sealedSender
    ) {
      deviceIds = reject(
        deviceIds,
        deviceId =>
          // because we store our own device ID as a string at least sometimes
          deviceId === ourDeviceId ||
          (typeof ourDeviceId === 'string' &&
            deviceId === parseInt(ourDeviceId, 10))
      );
    }

    const sessionStore = new Sessions({ ourUuid });
    const identityKeyStore = new IdentityKeys({ ourUuid });

    return Promise.all(
      deviceIds.map(async destinationDeviceId => {
        const theirUuid = UUID.checkedLookup(identifier);
        const address = new QualifiedAddress(
          ourUuid,
          new Address(theirUuid, destinationDeviceId)
        );

        return window.textsecure.storage.protocol.enqueueSessionJob<MessageType>(
          address,
          async () => {
            const protocolAddress = ProtocolAddress.new(
              theirUuid.toString(),
              destinationDeviceId
            );

            const activeSession = await sessionStore.getSession(
              protocolAddress
            );
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
          return this.transmitMessage(identifier, jsonData, this.timestamp, {
            accessKey,
          }).then(
            () => {
              this.recipients[identifier] = deviceIds;
              this.unidentifiedDeliveries.push(identifier);
              this.successfulIdentifiers.push(identifier);
              this.numberCompleted();

              if (this.sendLogCallback) {
                this.sendLogCallback({
                  identifier,
                  deviceIds,
                });
              } else if (this.successfulIdentifiers.length > 1) {
                log.warn(
                  `OutgoingMessage.doSendMessage: no sendLogCallback provided for message ${this.timestamp}, but multiple recipients`
                );
              }
            },
            async (error: Error) => {
              if (
                error instanceof HTTPError &&
                (error.code === 401 || error.code === 403)
              ) {
                if (this.failoverIdentifiers.indexOf(identifier) === -1) {
                  this.failoverIdentifiers.push(identifier);
                }

                // This ensures that we don't hit this codepath the next time through
                if (sendMetadata) {
                  delete sendMetadata[identifier];
                }

                return this.doSendMessage(identifier, deviceIds, recurse);
              }

              throw error;
            }
          );
        }

        return this.transmitMessage(identifier, jsonData, this.timestamp).then(
          () => {
            this.successfulIdentifiers.push(identifier);
            this.recipients[identifier] = deviceIds;
            this.numberCompleted();

            if (this.sendLogCallback) {
              this.sendLogCallback({
                identifier,
                deviceIds,
              });
            } else if (this.successfulIdentifiers.length > 1) {
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
              identifier,
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
            p = this.removeDeviceIdsForIdentifier(
              identifier,
              response.extraDevices || []
            );
          } else {
            p = Promise.all(
              (response.staleDevices || []).map(async (deviceId: number) => {
                await window.textsecure.storage.protocol.archiveSession(
                  new QualifiedAddress(
                    ourUuid,
                    new Address(UUID.checkedLookup(identifier), deviceId)
                  )
                );
              })
            );
          }

          return p.then(async () => {
            const resetDevices =
              error.code === 410
                ? response.staleDevices
                : response.missingDevices;
            return this.getKeysForIdentifier(identifier, resetDevices).then(
              // We continue to retry as long as the error code was 409; the assumption is
              //   that we'll request new device info and the next request will succeed.
              this.reloadDevicesAndSend(identifier, error.code === 409)
            );
          });
        }
        if (error?.message?.includes('untrusted identity for address')) {
          error.timestamp = this.timestamp;
          log.error(
            'Got "key changed" error from encrypt - no identityKey for application layer',
            identifier,
            deviceIds
          );

          log.info('closing all sessions for', identifier);
          window.textsecure.storage.protocol
            .archiveAllSessions(UUID.checkedLookup(identifier))
            .then(
              () => {
                throw error;
              },
              innerError => {
                log.error(
                  `doSendMessage: Error closing sessions: ${innerError.stack}`
                );
                throw error;
              }
            );
        }

        this.registerError(
          identifier,
          'Failed to create or send message',
          error
        );

        return undefined;
      });
  }

  async removeDeviceIdsForIdentifier(
    identifier: string,
    deviceIdsToRemove: Array<number>
  ): Promise<void> {
    const ourUuid = window.textsecure.storage.user.getCheckedUuid();
    const theirUuid = UUID.checkedLookup(identifier);

    await Promise.all(
      deviceIdsToRemove.map(async deviceId => {
        await window.textsecure.storage.protocol.archiveSession(
          new QualifiedAddress(ourUuid, new Address(theirUuid, deviceId))
        );
      })
    );
  }

  async sendToIdentifier(providedIdentifier: string): Promise<void> {
    let identifier = providedIdentifier;
    try {
      if (isValidUuid(identifier)) {
        // We're good!
      } else if (isValidNumber(identifier)) {
        if (!window.textsecure.messaging) {
          throw new Error(
            'sendToIdentifier: window.textsecure.messaging is not available!'
          );
        }

        try {
          await updateConversationsWithUuidLookup({
            conversationController: window.ConversationController,
            conversations: [
              window.ConversationController.getOrCreate(identifier, 'private'),
            ],
            messaging: window.textsecure.messaging,
          });

          const uuid =
            window.ConversationController.get(identifier)?.get('uuid');
          if (!uuid) {
            throw new UnregisteredUserError(
              identifier,
              new HTTPError('User is not registered', {
                code: -1,
                headers: {},
              })
            );
          }
          identifier = uuid;
        } catch (error) {
          log.error(
            `sendToIdentifier: Failed to fetch UUID for identifier ${identifier}`,
            error && error.stack ? error.stack : error
          );
        }
      } else {
        throw new Error(
          `sendToIdentifier: identifier ${identifier} was neither a UUID or E164`
        );
      }

      const ourUuid = window.textsecure.storage.user.getCheckedUuid();
      const deviceIds = await window.textsecure.storage.protocol.getDeviceIds({
        ourUuid,
        identifier,
      });
      if (deviceIds.length === 0) {
        await this.getKeysForIdentifier(identifier);
      }
      await this.reloadDevicesAndSend(identifier, true)();
    } catch (error) {
      if (error?.message?.includes('untrusted identity for address')) {
        const newError = new OutgoingIdentityKeyError(identifier);
        this.registerError(identifier, 'Untrusted identity', newError);
      } else {
        this.registerError(
          identifier,
          `Failed to retrieve new device keys for identifier ${identifier}`,
          error
        );
      }
    }
  }
}
