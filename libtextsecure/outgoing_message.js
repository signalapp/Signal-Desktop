/* global textsecure, libsignal, window, btoa, _ */

/* eslint-disable more/no-then */

function OutgoingMessage(
  server,
  timestamp,
  numbers,
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
  this.numbers = numbers;
  this.message = message; // ContentMessage proto
  this.callback = callback;
  this.silent = silent;

  this.numbersCompleted = 0;
  this.errors = [];
  this.successfulNumbers = [];
  this.failoverNumbers = [];
  this.unidentifiedDeliveries = [];

  const { numberInfo, senderCertificate } = options;
  this.numberInfo = numberInfo;
  this.senderCertificate = senderCertificate;
}

OutgoingMessage.prototype = {
  constructor: OutgoingMessage,
  numberCompleted() {
    this.numbersCompleted += 1;
    if (this.numbersCompleted >= this.numbers.length) {
      this.callback({
        successfulNumbers: this.successfulNumbers,
        failoverNumbers: this.failoverNumbers,
        errors: this.errors,
        unidentifiedDeliveries: this.unidentifiedDeliveries,
      });
    }
  },
  registerError(number, reason, error) {
    if (!error || (error.name === 'HTTPError' && error.code !== 404)) {
      // eslint-disable-next-line no-param-reassign
      error = new textsecure.OutgoingMessageError(
        number,
        this.message.toArrayBuffer(),
        this.timestamp,
        error
      );
    }

    // eslint-disable-next-line no-param-reassign
    error.number = number;
    // eslint-disable-next-line no-param-reassign
    error.reason = reason;
    this.errors[this.errors.length] = error;
    this.numberCompleted();
  },
  reloadDevicesAndSend(number, recurse, failover) {
    return () =>
      textsecure.storage.protocol.getDeviceIds(number).then(deviceIds => {
        if (deviceIds.length === 0) {
          return this.registerError(
            number,
            'Got empty device list when loading device keys',
            null
          );
        }
        return this.doSendMessage(number, deviceIds, recurse, failover);
      });
  },

  getKeysForNumber(number, updateDevices) {
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
              number,
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

    const { numberInfo } = this;
    const info = numberInfo && numberInfo[number] ? numberInfo[number] : {};
    const { accessKey } = info || {};

    if (updateDevices === undefined) {
      if (accessKey) {
        return this.server
          .getKeysForNumberUnauth(number, '*', { accessKey })
          .catch(error => {
            if (error.code === 401 || error.code === 403) {
              if (this.failoverNumbers.indexOf(number) === -1) {
                this.failoverNumbers.push(number);
              }
              return this.server.getKeysForNumber(number, '*');
            }
            throw error;
          })
          .then(handleResult);
      }

      return this.server.getKeysForNumber(number, '*').then(handleResult);
    }

    let promise = Promise.resolve();
    updateDevices.forEach(deviceId => {
      promise = promise.then(() => {
        let innerPromise;

        if (accessKey) {
          innerPromise = this.server
            .getKeysForNumberUnauth(number, deviceId, { accessKey })
            .then(handleResult)
            .catch(error => {
              if (error.code === 401 || error.code === 403) {
                if (this.failoverNumbers.indexOf(number) === -1) {
                  this.failoverNumbers.push(number);
                }
                return this.server
                  .getKeysForNumber(number, deviceId)
                  .then(handleResult);
              }
              throw error;
            });
        } else {
          innerPromise = this.server
            .getKeysForNumber(number, deviceId)
            .then(handleResult);
        }

        return innerPromise.catch(e => {
          if (e.name === 'HTTPError' && e.code === 404) {
            if (deviceId !== 1) {
              return this.removeDeviceIdsForNumber(number, [deviceId]);
            }
            throw new textsecure.UnregisteredUserError(number, e);
          } else {
            throw e;
          }
        });
      });
    });

    return promise;
  },

  transmitMessage(number, jsonData, timestamp, { accessKey } = {}) {
    let promise;

    if (accessKey) {
      promise = this.server.sendMessagesUnauth(
        number,
        jsonData,
        timestamp,
        this.silent,
        { accessKey }
      );
    } else {
      promise = this.server.sendMessages(
        number,
        jsonData,
        timestamp,
        this.silent
      );
    }

    return promise.catch(e => {
      if (e.name === 'HTTPError' && (e.code !== 409 && e.code !== 410)) {
        // 409 and 410 should bubble and be handled by doSendMessage
        // 404 should throw UnregisteredUserError
        // all other network errors can be retried later.
        if (e.code === 404) {
          throw new textsecure.UnregisteredUserError(number, e);
        }
        throw new textsecure.SendMessageNetworkError(
          number,
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

  doSendMessage(number, deviceIds, recurse, failover) {
    const ciphers = {};
    const plaintext = this.getPlaintext();

    const { numberInfo, senderCertificate } = this;
    const info = numberInfo && numberInfo[number] ? numberInfo[number] : {};
    const { accessKey } = info || {};

    if (accessKey && !senderCertificate) {
      return Promise.reject(
        new Error(
          'OutgoingMessage.doSendMessage: accessKey was provided, but senderCertificate was not'
        )
      );
    }

    // If failover is true, we don't send an unidentified sender message
    const sealedSender = Boolean(!failover && accessKey && senderCertificate);

    // We don't send to ourselves if unless sealedSender is enabled
    const ourNumber = textsecure.storage.user.getNumber();
    const ourDeviceId = textsecure.storage.user.getDeviceId();
    if (number === ourNumber && !sealedSender) {
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
        const address = new libsignal.SignalProtocolAddress(number, deviceId);

        const options = {};

        // No limit on message keys if we're communicating with our other devices
        if (ourNumber === number) {
          options.messageKeysLimit = false;
        }

        // If failover is true, we don't send an unidentified sender message
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
          return this.transmitMessage(number, jsonData, this.timestamp, {
            accessKey,
          }).then(
            () => {
              this.unidentifiedDeliveries.push(number);
              this.successfulNumbers.push(number);
              this.numberCompleted();
            },
            error => {
              if (error.code === 401 || error.code === 403) {
                if (this.failoverNumbers.indexOf(number) === -1) {
                  this.failoverNumbers.push(number);
                }
                if (info) {
                  info.accessKey = null;
                }

                // Set final parameter to true to ensure we don't hit this codepath a
                //   second time.
                return this.doSendMessage(number, deviceIds, recurse, true);
              }

              throw error;
            }
          );
        }

        return this.transmitMessage(number, jsonData, this.timestamp).then(
          () => {
            this.successfulNumbers.push(number);
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
              number,
              'Hit retry limit attempting to reload device list',
              error
            );

          let p;
          if (error.code === 409) {
            p = this.removeDeviceIdsForNumber(
              number,
              error.response.extraDevices
            );
          } else {
            p = Promise.all(
              error.response.staleDevices.map(deviceId =>
                ciphers[deviceId].closeOpenSessionForDevice(
                  new libsignal.SignalProtocolAddress(number, deviceId)
                )
              )
            );
          }

          return p.then(() => {
            const resetDevices =
              error.code === 410
                ? error.response.staleDevices
                : error.response.missingDevices;
            return this.getKeysForNumber(number, resetDevices).then(
              // For now, we we won't retry unidentified delivery if we get here; new
              //   devices could have been added which don't support it.
              this.reloadDevicesAndSend(number, error.code === 409, true)
            );
          });
        } else if (error.message === 'Identity key changed') {
          // eslint-disable-next-line no-param-reassign
          error.timestamp = this.timestamp;
          // eslint-disable-next-line no-param-reassign
          error.originalMessage = this.message.toArrayBuffer();
          window.log.error(
            'Got "key changed" error from encrypt - no identityKey for application layer',
            number,
            deviceIds
          );
          throw error;
        } else {
          this.registerError(number, 'Failed to create or send message', error);
        }

        return null;
      });
  },

  getStaleDeviceIdsForNumber(number) {
    return textsecure.storage.protocol.getDeviceIds(number).then(deviceIds => {
      if (deviceIds.length === 0) {
        return [1];
      }
      const updateDevices = [];
      return Promise.all(
        deviceIds.map(deviceId => {
          const address = new libsignal.SignalProtocolAddress(number, deviceId);
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

  removeDeviceIdsForNumber(number, deviceIdsToRemove) {
    let promise = Promise.resolve();
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const j in deviceIdsToRemove) {
      promise = promise.then(() => {
        const encodedNumber = `${number}.${deviceIdsToRemove[j]}`;
        return textsecure.storage.protocol.removeSession(encodedNumber);
      });
    }
    return promise;
  },

  async sendToNumber(number) {
    try {
      const updateDevices = await this.getStaleDeviceIdsForNumber(number);
      await this.getKeysForNumber(number, updateDevices);
      await this.reloadDevicesAndSend(number, true)();
    } catch (error) {
      if (error.message === 'Identity key changed') {
        // eslint-disable-next-line no-param-reassign
        const newError = new textsecure.OutgoingIdentityKeyError(
          number,
          error.originalMessage,
          error.timestamp,
          error.identityKey
        );
        this.registerError(number, 'Identity key changed', newError);
      } else {
        this.registerError(
          number,
          `Failed to retrieve new device keys for number ${number}`,
          error
        );
      }
    }
  },
};
