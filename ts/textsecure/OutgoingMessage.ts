// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable more/no-then */
/* eslint-disable no-param-reassign */

import { reject } from 'lodash';
import { ServerKeysType, WebAPIType } from './WebAPI';
import { isEnabled as isRemoteFlagEnabled } from '../RemoteConfig';
import { SignalProtocolAddressClass } from '../libsignal.d';
import { ContentClass, DataMessageClass } from '../textsecure.d';
import {
  CallbackResultType,
  SendMetadataType,
  SendOptionsType,
  CustomError,
} from './SendMessage';
import {
  OutgoingIdentityKeyError,
  OutgoingMessageError,
  SendMessageNetworkError,
  UnregisteredUserError,
} from './Errors';
import { isValidNumber } from '../types/PhoneNumber';
import {
  SecretSessionCipher,
  SerializedCertificateType,
} from '../metadata/SecretSessionCipher';

type OutgoingMessageOptionsType = SendOptionsType & {
  online?: boolean;
};

export default class OutgoingMessage {
  server: WebAPIType;

  timestamp: number;

  identifiers: Array<string>;

  message: ContentClass;

  callback: (result: CallbackResultType) => void;

  silent?: boolean;

  plaintext?: Uint8Array;

  identifiersCompleted: number;

  errors: Array<CustomError>;

  successfulIdentifiers: Array<unknown>;

  failoverIdentifiers: Array<unknown>;

  unidentifiedDeliveries: Array<unknown>;

  sendMetadata?: SendMetadataType;

  senderCertificate?: SerializedCertificateType;

  online?: boolean;

  constructor(
    server: WebAPIType,
    timestamp: number,
    identifiers: Array<string>,
    message: ContentClass | DataMessageClass,
    silent: boolean | undefined,
    callback: (result: CallbackResultType) => void,
    options: OutgoingMessageOptionsType = {}
  ) {
    if (message instanceof window.textsecure.protobuf.DataMessage) {
      const content = new window.textsecure.protobuf.Content();
      content.dataMessage = message;
      // eslint-disable-next-line no-param-reassign
      this.message = content;
    } else {
      this.message = message;
    }

    this.server = server;
    this.timestamp = timestamp;
    this.identifiers = identifiers;
    this.callback = callback;
    this.silent = silent;

    this.identifiersCompleted = 0;
    this.errors = [];
    this.successfulIdentifiers = [];
    this.failoverIdentifiers = [];
    this.unidentifiedDeliveries = [];

    const { sendMetadata, senderCertificate, online } = options;
    this.sendMetadata = sendMetadata;
    this.senderCertificate = senderCertificate;
    this.online = online;
  }

  numberCompleted(): void {
    this.identifiersCompleted += 1;
    if (this.identifiersCompleted >= this.identifiers.length) {
      this.callback({
        successfulIdentifiers: this.successfulIdentifiers,
        failoverIdentifiers: this.failoverIdentifiers,
        errors: this.errors,
        unidentifiedDeliveries: this.unidentifiedDeliveries,
      });
    }
  }

  registerError(
    identifier: string,
    reason: string,
    providedError?: Error
  ): void {
    let error = providedError;

    if (!error || (error.name === 'HTTPError' && error.code !== 404)) {
      error = new OutgoingMessageError(
        identifier,
        this.message.toArrayBuffer(),
        this.timestamp,
        error
      );
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
    return async () =>
      window.textsecure.storage.protocol
        .getDeviceIds(identifier)
        .then(async deviceIds => {
          if (deviceIds.length === 0) {
            this.registerError(
              identifier,
              'Got empty device list when loading device keys',
              undefined
            );
            return undefined;
          }
          return this.doSendMessage(identifier, deviceIds, recurse);
        });
  }

  async getKeysForIdentifier(
    identifier: string,
    updateDevices: Array<number>
  ): Promise<void | Array<void | null>> {
    const handleResult = async (response: ServerKeysType) =>
      Promise.all(
        response.devices.map(async device => {
          if (
            updateDevices === undefined ||
            updateDevices.indexOf(device.deviceId) > -1
          ) {
            const address = new window.libsignal.SignalProtocolAddress(
              identifier,
              device.deviceId
            );
            const builder = new window.libsignal.SessionBuilder(
              window.textsecure.storage.protocol,
              address
            );
            if (device.registrationId === 0) {
              window.log.info('device registrationId 0!');
            }

            const deviceForProcess = {
              ...device,
              identityKey: response.identityKey,
            };
            return builder.processPreKey(deviceForProcess).catch(error => {
              if (error.message === 'Identity key changed') {
                error.timestamp = this.timestamp;
                error.originalMessage = this.message.toArrayBuffer();
                error.identityKey = response.identityKey;
              }
              throw error;
            });
          }

          return null;
        })
      );

    const { sendMetadata } = this;
    const info =
      sendMetadata && sendMetadata[identifier]
        ? sendMetadata[identifier]
        : { accessKey: undefined };
    const { accessKey } = info;

    if (updateDevices === undefined) {
      if (accessKey) {
        return this.server
          .getKeysForIdentifierUnauth(identifier, undefined, { accessKey })
          .catch(async (error: Error) => {
            if (error.code === 401 || error.code === 403) {
              if (this.failoverIdentifiers.indexOf(identifier) === -1) {
                this.failoverIdentifiers.push(identifier);
              }
              return this.server.getKeysForIdentifier(identifier);
            }
            throw error;
          })
          .then(handleResult);
      }

      return this.server.getKeysForIdentifier(identifier).then(handleResult);
    }

    let promise: Promise<void | Array<void | null>> = Promise.resolve();
    updateDevices.forEach(deviceId => {
      promise = promise.then(async () => {
        let innerPromise;

        if (accessKey) {
          innerPromise = this.server
            .getKeysForIdentifierUnauth(identifier, deviceId, { accessKey })
            .then(handleResult)
            .catch(async error => {
              if (error.code === 401 || error.code === 403) {
                if (this.failoverIdentifiers.indexOf(identifier) === -1) {
                  this.failoverIdentifiers.push(identifier);
                }
                return this.server
                  .getKeysForIdentifier(identifier, deviceId)
                  .then(handleResult);
              }
              throw error;
            });
        } else {
          innerPromise = this.server
            .getKeysForIdentifier(identifier, deviceId)
            .then(handleResult);
        }

        return innerPromise.catch(async e => {
          if (e.name === 'HTTPError' && e.code === 404) {
            if (deviceId !== 1) {
              return this.removeDeviceIdsForIdentifier(identifier, [deviceId]);
            }
            throw new UnregisteredUserError(identifier, e);
          } else {
            throw e;
          }
        });
      });
    });

    return promise;
  }

  async transmitMessage(
    identifier: string,
    jsonData: Array<unknown>,
    timestamp: number,
    { accessKey }: { accessKey?: string } = {}
  ): Promise<void> {
    let promise;

    if (accessKey) {
      promise = this.server.sendMessagesUnauth(
        identifier,
        jsonData,
        timestamp,
        this.silent,
        this.online,
        { accessKey }
      );
    } else {
      promise = this.server.sendMessages(
        identifier,
        jsonData,
        timestamp,
        this.silent,
        this.online
      );
    }

    return promise.catch(e => {
      if (e.name === 'HTTPError' && e.code !== 409 && e.code !== 410) {
        // 409 and 410 should bubble and be handled by doSendMessage
        // 404 should throw UnregisteredUserError
        // all other network errors can be retried later.
        if (e.code === 404) {
          throw new UnregisteredUserError(identifier, e);
        }
        throw new SendMessageNetworkError(identifier, jsonData, e);
      }
      throw e;
    });
  }

  getPaddedMessageLength(messageLength: number): number {
    const messageLengthWithTerminator = messageLength + 1;
    let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

    if (messageLengthWithTerminator % 160 !== 0) {
      messagePartCount += 1;
    }

    return messagePartCount * 160;
  }

  getPlaintext(): ArrayBuffer {
    if (!this.plaintext) {
      const messageBuffer = this.message.toArrayBuffer();
      this.plaintext = new Uint8Array(
        this.getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
      );
      this.plaintext.set(new Uint8Array(messageBuffer));
      this.plaintext[messageBuffer.byteLength] = 0x80;
    }
    return this.plaintext;
  }

  async doSendMessage(
    identifier: string,
    deviceIds: Array<number>,
    recurse?: boolean
  ): Promise<void> {
    const ciphers: {
      [key: number]: {
        closeOpenSessionForDevice: (
          address: SignalProtocolAddressClass
        ) => Promise<void>;
      };
    } = {};
    const plaintext = this.getPlaintext();

    const { sendMetadata, senderCertificate } = this;
    const info =
      sendMetadata && sendMetadata[identifier]
        ? sendMetadata[identifier]
        : { accessKey: undefined };
    const { accessKey } = info;

    if (accessKey && !senderCertificate) {
      window.log.warn(
        'OutgoingMessage.doSendMessage: accessKey was provided, but senderCertificate was not'
      );
    }

    const sealedSender = Boolean(accessKey && senderCertificate);

    // We don't send to ourselves if unless sealedSender is enabled
    const ourNumber = window.textsecure.storage.user.getNumber();
    const ourUuid = window.textsecure.storage.user.getUuid();
    const ourDeviceId = window.textsecure.storage.user.getDeviceId();
    if ((identifier === ourNumber || identifier === ourUuid) && !sealedSender) {
      deviceIds = reject(
        deviceIds,
        deviceId =>
          // because we store our own device ID as a string at least sometimes
          deviceId === ourDeviceId ||
          (typeof ourDeviceId === 'string' &&
            deviceId === parseInt(ourDeviceId, 10))
      );
    }

    return Promise.all(
      deviceIds.map(async deviceId => {
        const address = new window.libsignal.SignalProtocolAddress(
          identifier,
          deviceId
        );

        const options: any = {};

        // No limit on message keys if we're communicating with our other devices
        if (ourNumber === identifier || ourUuid === identifier) {
          options.messageKeysLimit = false;
        }

        if (sealedSender && senderCertificate) {
          const secretSessionCipher = new SecretSessionCipher(
            window.textsecure.storage.protocol
          );
          ciphers[address.getDeviceId()] = secretSessionCipher;

          const ciphertext = await secretSessionCipher.encrypt(
            address,
            senderCertificate,
            plaintext
          );

          return {
            type: window.textsecure.protobuf.Envelope.Type.UNIDENTIFIED_SENDER,
            destinationDeviceId: address.getDeviceId(),
            destinationRegistrationId: await secretSessionCipher.getRemoteRegistrationId(
              address
            ),
            content: window.Signal.Crypto.arrayBufferToBase64(ciphertext),
          };
        }
        const sessionCipher = new window.libsignal.SessionCipher(
          window.textsecure.storage.protocol,
          address,
          options
        );
        ciphers[address.getDeviceId()] = sessionCipher;

        const ciphertext = await sessionCipher.encrypt(plaintext);
        return {
          type: ciphertext.type,
          destinationDeviceId: address.getDeviceId(),
          destinationRegistrationId: ciphertext.registrationId,
          content: btoa(ciphertext.body),
        };
      })
    )
      .then(async jsonData => {
        if (sealedSender) {
          return this.transmitMessage(identifier, jsonData, this.timestamp, {
            accessKey,
          }).then(
            () => {
              this.unidentifiedDeliveries.push(identifier);
              this.successfulIdentifiers.push(identifier);
              this.numberCompleted();
            },
            async (error: Error) => {
              if (error.code === 401 || error.code === 403) {
                if (this.failoverIdentifiers.indexOf(identifier) === -1) {
                  this.failoverIdentifiers.push(identifier);
                }

                // This ensures that we don't hit this codepath the next time through
                if (info) {
                  info.accessKey = undefined;
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
            this.numberCompleted();
          }
        );
      })
      .catch(async error => {
        if (
          error instanceof Error &&
          error.name === 'HTTPError' &&
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

          let p: Promise<any> = Promise.resolve();
          if (error.code === 409) {
            p = this.removeDeviceIdsForIdentifier(
              identifier,
              error.response.extraDevices || []
            );
          } else {
            p = Promise.all(
              error.response.staleDevices.map(async (deviceId: number) =>
                ciphers[deviceId].closeOpenSessionForDevice(
                  new window.libsignal.SignalProtocolAddress(
                    identifier,
                    deviceId
                  )
                )
              )
            );
          }

          return p.then(async () => {
            const resetDevices =
              error.code === 410
                ? error.response.staleDevices
                : error.response.missingDevices;
            return this.getKeysForIdentifier(identifier, resetDevices).then(
              // We continue to retry as long as the error code was 409; the assumption is
              //   that we'll request new device info and the next request will succeed.
              this.reloadDevicesAndSend(identifier, error.code === 409)
            );
          });
        }
        if (error.message === 'Identity key changed') {
          // eslint-disable-next-line no-param-reassign
          error.timestamp = this.timestamp;
          // eslint-disable-next-line no-param-reassign
          error.originalMessage = this.message.toArrayBuffer();
          window.log.error(
            'Got "key changed" error from encrypt - no identityKey for application layer',
            identifier,
            deviceIds
          );

          window.log.info('closing all sessions for', identifier);
          const address = new window.libsignal.SignalProtocolAddress(
            identifier,
            1
          );

          const sessionCipher = new window.libsignal.SessionCipher(
            window.textsecure.storage.protocol,
            address
          );
          window.log.info('closing session for', address.toString());
          return Promise.all([
            // Primary device
            sessionCipher.closeOpenSessionForDevice(),
            // The rest of their devices
            window.textsecure.storage.protocol.archiveSiblingSessions(
              address.toString()
            ),
          ]).then(
            () => {
              throw error;
            },
            innerError => {
              window.log.error(
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

  async getStaleDeviceIdsForIdentifier(
    identifier: string
  ): Promise<Array<number>> {
    return window.textsecure.storage.protocol
      .getDeviceIds(identifier)
      .then(async deviceIds => {
        if (deviceIds.length === 0) {
          return [1];
        }
        const updateDevices: Array<number> = [];
        return Promise.all(
          deviceIds.map(async deviceId => {
            const address = new window.libsignal.SignalProtocolAddress(
              identifier,
              deviceId
            );
            const sessionCipher = new window.libsignal.SessionCipher(
              window.textsecure.storage.protocol,
              address
            );
            return sessionCipher.hasOpenSession().then(hasSession => {
              if (!hasSession) {
                updateDevices.push(deviceId);
              }
            });
          })
        ).then(() => updateDevices);
      });
  }

  async removeDeviceIdsForIdentifier(
    identifier: string,
    deviceIdsToRemove: Array<number>
  ): Promise<void> {
    await Promise.all(
      deviceIdsToRemove.map(async deviceId => {
        const address = new window.libsignal.SignalProtocolAddress(
          identifier,
          deviceId
        );
        const sessionCipher = new window.libsignal.SessionCipher(
          window.textsecure.storage.protocol,
          address
        );
        await sessionCipher.closeOpenSessionForDevice();
      })
    );
  }

  async sendToIdentifier(providedIdentifier: string): Promise<void> {
    let identifier = providedIdentifier;
    try {
      if (isRemoteFlagEnabled('desktop.cds')) {
        if (window.isValidGuid(identifier)) {
          // We're good!
        } else if (isValidNumber(identifier)) {
          if (!window.textsecure.messaging) {
            throw new Error(
              'sendToIdentifier: window.textsecure.messaging is not available!'
            );
          }
          try {
            const lookup = await window.textsecure.messaging.getUuidsForE164s([
              identifier,
            ]);
            const uuid = lookup[identifier];
            if (uuid) {
              window.ConversationController.ensureContactIds({
                uuid,
                e164: identifier,
                highTrust: true,
              });
              identifier = uuid;
            } else {
              const c = window.ConversationController.get(identifier);
              if (c) {
                c.setUnregistered();
              }

              throw new UnregisteredUserError(
                identifier,
                new Error('User is not registered')
              );
            }
          } catch (error) {
            window.log.error(
              `sentToIdentifier: Failed to fetch UUID for identifier ${identifier}`,
              error && error.stack ? error.stack : error
            );
          }
        } else {
          throw new Error(
            `sendToIdentifier: identifier ${identifier} was neither a UUID or E164`
          );
        }
      }

      const updateDevices = await this.getStaleDeviceIdsForIdentifier(
        identifier
      );
      await this.getKeysForIdentifier(identifier, updateDevices);
      await this.reloadDevicesAndSend(identifier, true)();
    } catch (error) {
      if (error.message === 'Identity key changed') {
        const newError = new OutgoingIdentityKeyError(
          identifier,
          error.originalMessage,
          error.timestamp,
          error.identityKey
        );
        this.registerError(identifier, 'Identity key changed', newError);
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
