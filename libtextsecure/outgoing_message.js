/* global textsecure, libsignal, window, btoa, _ */

/* eslint-disable more/no-then */

function OutgoingMessage(
  server,
  timestamp,
  identifiers,
  message,
  silent,
  callback,
  options = {}
) {
  if (message instanceof textsecure.protobuf.DataMessage) {
    const content = new textsecure.protobuf.Content();
    content.dataMessage = message;
    // eslint-disable-next-line no-param-reassign
    message = content;
  }
  this.server = server;
  this.timestamp = timestamp;
  this.identifiers = identifiers;
  this.message = message; // ContentMessage proto
  this.callback = callback;
  this.silent = silent;

  this.identifiersCompleted = 0;
  this.errors = [];
  this.successfulIdentifiers = [];
  this.failoverIdentifiers = [];
  this.unidentifiedDeliveries = [];

  const { sendMetadata, senderCertificate, senderCertificateWithUuid, online } =
    options || {};
  this.sendMetadata = sendMetadata;
  this.senderCertificate = senderCertificate;
  this.senderCertificateWithUuid = senderCertificateWithUuid;
  this.online = online;
}

OutgoingMessage.prototype = {
  constructor: OutgoingMessage,
  numberCompleted() {
    this.identifiersCompleted += 1;
    if (this.identifiersCompleted >= this.identifiers.length) {
      this.callback({
        successfulIdentifiers: this.successfulIdentifiers,
        failoverIdentifiers: this.failoverIdentifiers,
        errors: this.errors,
        unidentifiedDeliveries: this.unidentifiedDeliveries,
      });
    }
  },
  registerError(identifier, reason, error) {
    if (!error || (error.name === 'HTTPError' && error.code !== 404)) {
      // eslint-disable-next-line no-param-reassign
      error = new textsecure.OutgoingMessageError(
        identifier,
        this.message.toArrayBuffer(),
        this.timestamp,
        error
      );
    }

    // eslint-disable-next-line no-param-reassign
    error.number = identifier;
    // eslint-disable-next-line no-param-reassign
    error.reason = reason;
    this.errors[this.errors.length] = error;
    this.numberCompleted();
  },
  reloadDevicesAndSend(identifier, recurse) {
    return () =>
      textsecure.storage.protocol.getDeviceIds(identifier).then(deviceIds => {
        if (deviceIds.length === 0) {
          return this.registerError(
            identifier,
            'Got empty device list when loading device keys',
            null
          );
        }
        return this.doSendMessage(identifier, deviceIds, recurse);
      });
  },

  getKeysForIdentifier(identifier, updateDevices) {
    const handleResult = response =>
      Promise.all(
        response.devices.map(device => {
          // eslint-disable-next-line no-param-reassign
          device.identityKey = response.identityKey;
          if (
            updateDevices === undefined ||
            updateDevices.indexOf(device.deviceId) > -1
          ) {
            const address = new libsignal.SignalProtocolAddress(
              identifier,
              device.deviceId
            );
            const builder = new libsignal.SessionBuilder(
              textsecure.storage.protocol,
              address
            );
            if (device.registrationId === 0) {
              window.log.info('device registrationId 0!');
            }
            return builder.processPreKey(device).catch(error => {
              if (error.message === 'Identity key changed') {
                // eslint-disable-next-line no-param-reassign
                error.timestamp = this.timestamp;
                // eslint-disable-next-line no-param-reassign
                error.originalMessage = this.message.toArrayBuffer();
                // eslint-disable-next-line no-param-reassign
                error.identityKey = device.identityKey;
              }
              throw error;
            });
          }

          return null;
        })
      );

    const { sendMetadata } = this;
    const info =
      sendMetadata && sendMetadata[identifier] ? sendMetadata[identifier] : {};
    const { accessKey } = info || {};

    if (updateDevices === undefined) {
      if (accessKey) {
        return this.server
          .getKeysForIdentifierUnauth(identifier, '*', { accessKey })
          .catch(error => {
            if (error.code === 401 || error.code === 403) {
              if (this.failoverIdentifiers.indexOf(identifier) === -1) {
                this.failoverIdentifiers.push(identifier);
              }
              return this.server.getKeysForIdentifier(identifier, '*');
            }
            throw error;
          })
          .then(handleResult);
      }

      return this.server
        .getKeysForIdentifier(identifier, '*')
        .then(handleResult);
    }

    let promise = Promise.resolve();
    updateDevices.forEach(deviceId => {
      promise = promise.then(() => {
        let innerPromise;

        if (accessKey) {
          innerPromise = this.server
            .getKeysForIdentifierUnauth(identifier, deviceId, { accessKey })
            .then(handleResult)
            .catch(error => {
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

        return innerPromise.catch(e => {
          if (e.name === 'HTTPError' && e.code === 404) {
            if (deviceId !== 1) {
              return this.removeDeviceIdsForIdentifier(identifier, [deviceId]);
            }
            throw new textsecure.UnregisteredUserError(identifier, e);
          } else {
            throw e;
          }
        });
      });
    });

    return promise;
  },

  transmitMessage(identifier, jsonData, timestamp, { accessKey } = {}) {
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
          throw new textsecure.UnregisteredUserError(identifier, e);
        }
        throw new textsecure.SendMessageNetworkError(
          identifier,
          jsonData,
          e,
          timestamp
        );
      }
      throw e;
    });
  },

  getPaddedMessageLength(messageLength) {
    const messageLengthWithTerminator = messageLength + 1;
    let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

    if (messageLengthWithTerminator % 160 !== 0) {
      messagePartCount += 1;
    }

    return messagePartCount * 160;
  },

  getPlaintext() {
    if (!this.plaintext) {
      const messageBuffer = this.message.toArrayBuffer();
      this.plaintext = new Uint8Array(
        this.getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
      );
      this.plaintext.set(new Uint8Array(messageBuffer));
      this.plaintext[messageBuffer.byteLength] = 0x80;
    }
    return this.plaintext;
  },

  doSendMessage(identifier, deviceIds, recurse) {
    const ciphers = {};
    const plaintext = this.getPlaintext();

    const { sendMetadata } = this;
    const info =
      sendMetadata && sendMetadata[identifier] ? sendMetadata[identifier] : {};
    const { accessKey, useUuidSenderCert } = info || {};
    const senderCertificate = useUuidSenderCert
      ? this.senderCertificateWithUuid
      : this.senderCertificate;

    if (accessKey && !senderCertificate) {
      window.log.warn(
        'OutgoingMessage.doSendMessage: accessKey was provided, but senderCertificate was not'
      );
    }

    const sealedSender = Boolean(accessKey && senderCertificate);

    // We don't send to ourselves if unless sealedSender is enabled
    const ourNumber = textsecure.storage.user.getNumber();
    const ourUuid = textsecure.storage.user.getUuid();
    const ourDeviceId = textsecure.storage.user.getDeviceId();
    if ((identifier === ourNumber || identifier === ourUuid) && !sealedSender) {
      // eslint-disable-next-line no-param-reassign
      deviceIds = _.reject(
        deviceIds,
        deviceId =>
          // because we store our own device ID as a string at least sometimes
          deviceId === ourDeviceId || deviceId === parseInt(ourDeviceId, 10)
      );
    }

    return Promise.all(
      deviceIds.map(async deviceId => {
        const address = new libsignal.SignalProtocolAddress(
          identifier,
          deviceId
        );

        const options = {};

        // No limit on message keys if we're communicating with our other devices
        if (ourNumber === identifier || ourUuid === identifier) {
          options.messageKeysLimit = false;
        }

        if (sealedSender) {
          const secretSessionCipher = new window.Signal.Metadata.SecretSessionCipher(
            textsecure.storage.protocol
          );
          ciphers[address.getDeviceId()] = secretSessionCipher;

          const ciphertext = await secretSessionCipher.encrypt(
            address,
            senderCertificate,
            plaintext
          );

          return {
            type: textsecure.protobuf.Envelope.Type.UNIDENTIFIED_SENDER,
            destinationDeviceId: address.getDeviceId(),
            destinationRegistrationId: await secretSessionCipher.getRemoteRegistrationId(
              address
            ),
            content: window.Signal.Crypto.arrayBufferToBase64(ciphertext),
          };
        }

        const sessionCipher = new libsignal.SessionCipher(
          textsecure.storage.protocol,
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
      .then(jsonData => {
        if (sealedSender) {
          return this.transmitMessage(identifier, jsonData, this.timestamp, {
            accessKey,
          }).then(
            () => {
              this.unidentifiedDeliveries.push(identifier);
              this.successfulIdentifiers.push(identifier);
              this.numberCompleted();
            },
            error => {
              if (error.code === 401 || error.code === 403) {
                if (this.failoverIdentifiers.indexOf(identifier) === -1) {
                  this.failoverIdentifiers.push(identifier);
                }
                if (info) {
                  info.accessKey = null;
                }

                // Set final parameter to true to ensure we don't hit this codepath a
                //   second time.
                return this.doSendMessage(identifier, deviceIds, recurse, true);
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
      .catch(error => {
        if (
          error instanceof Error &&
          error.name === 'HTTPError' &&
          (error.code === 410 || error.code === 409)
        ) {
          if (!recurse)
            return this.registerError(
              identifier,
              'Hit retry limit attempting to reload device list',
              error
            );

          let p;
          if (error.code === 409) {
            p = this.removeDeviceIdsForIdentifier(
              identifier,
              error.response.extraDevices
            );
          } else {
            p = Promise.all(
              error.response.staleDevices.map(deviceId =>
                ciphers[deviceId].closeOpenSessionForDevice(
                  new libsignal.SignalProtocolAddress(identifier, deviceId)
                )
              )
            );
          }

          return p.then(() => {
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
        } else if (error.message === 'Identity key changed') {
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
          const address = new libsignal.SignalProtocolAddress(identifier, 1);

          const sessionCipher = new libsignal.SessionCipher(
            textsecure.storage.protocol,
            address
          );
          window.log.info('closing session for', address.toString());
          return Promise.all([
            // Primary device
            sessionCipher.closeOpenSessionForDevice(),
            // The rest of their devices
            textsecure.storage.protocol.archiveSiblingSessions(
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
        return null;
      });
  },

  getStaleDeviceIdsForIdentifier(identifier) {
    return textsecure.storage.protocol
      .getDeviceIds(identifier)
      .then(deviceIds => {
        if (deviceIds.length === 0) {
          return [1];
        }
        const updateDevices = [];
        return Promise.all(
          deviceIds.map(deviceId => {
            const address = new libsignal.SignalProtocolAddress(
              identifier,
              deviceId
            );
            const sessionCipher = new libsignal.SessionCipher(
              textsecure.storage.protocol,
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
  },

  removeDeviceIdsForIdentifier(identifier, deviceIdsToRemove) {
    let promise = Promise.resolve();
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const j in deviceIdsToRemove) {
      promise = promise.then(() => {
        const encodedAddress = `${identifier}.${deviceIdsToRemove[j]}`;
        return textsecure.storage.protocol.removeSession(encodedAddress);
      });
    }
    return promise;
  },

  async sendToIdentifier(identifier) {
    try {
      const updateDevices = await this.getStaleDeviceIdsForIdentifier(
        identifier
      );
      await this.getKeysForIdentifier(identifier, updateDevices);
      await this.reloadDevicesAndSend(identifier, true)();
    } catch (error) {
      if (error.message === 'Identity key changed') {
        // eslint-disable-next-line no-param-reassign
        const newError = new textsecure.OutgoingIdentityKeyError(
          identifier,
          error.originalMessage,
          error.timestamp,
          error.identityKey
        );
        this.registerError(identifier, 'Identity key changed', newError);
      } else {
        this.registerError(
          identifier,
          `Failed to retrieve new device keys for number ${identifier}`,
          error
        );
      }
    }
  },
};
