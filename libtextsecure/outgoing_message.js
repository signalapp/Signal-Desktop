/* global textsecure, libsignal, window, btoa, libloki */

/* eslint-disable more/no-then */

function OutgoingMessage(
  server,
  timestamp,
  numbers,
  message,
  silent,
  callback
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

  this.lokiserver = window.LokiAPI.connect()

  this.numbersCompleted = 0;
  this.errors = [];
  this.successfulNumbers = [];
  this.fallBackEncryption = false;
}

OutgoingMessage.prototype = {
  constructor: OutgoingMessage,
  numberCompleted() {
    this.numbersCompleted += 1;
    if (this.numbersCompleted >= this.numbers.length) {
      this.callback({
        successfulNumbers: this.successfulNumbers,
        errors: this.errors,
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
  reloadDevicesAndSend(number, recurse) {
    return () =>
      textsecure.storage.protocol.getDeviceIds(number).then(deviceIds => {
        if (deviceIds.length === 0) {
          deviceIds = [1];
          // return this.registerError(
          //   number,
          //   'Got empty device list when loading device keys',
          //   null
          // );
        }
        return this.doSendMessage(number, deviceIds, recurse);
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

          return true;
        })
      );
    // TODO: check if still applicable
    if (updateDevices === undefined) {
      return this.server.getKeysForNumber(number).then(handleResult);
    }
    let promise = Promise.resolve();
    updateDevices.forEach(device => {
      promise = promise.then(() =>
        Promise.all([
          textsecure.storage.protocol.loadContactPreKey(number),
          textsecure.storage.protocol.loadContactSignedPreKey(number)
        ]).then((keys) => {
          const [preKey, signedPreKey] = keys;
          if (preKey == undefined || signedPreKey == undefined) {
            return false;
          }
          else {
            const identityKey = StringView.hexToArrayBuffer(number);
            return handleResult({ identityKey, devices: [{ deviceId: device, preKey, signedPreKey, registrationId: 0 }] })
          }
        })
          .catch(e => {
            if (e.name === 'HTTPError' && e.code === 404) {
              if (device !== 1) {
                return this.removeDeviceIdsForNumber(number, [device]);
              }
              throw new textsecure.UnregisteredUserError(number, e);
            } else {
              throw e;
            }
          })
      );
    });

    return promise;
  },

  async transmitMessage(number, data, timestamp) {
    const pubKey = number;
    const ttl = 2 * 24 * 60 * 60;
    try {
      const [response, status] = await this.lokiserver.sendMessage(pubKey, data, ttl);
      return response;
    }
    catch (e) {
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
    }
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
      this.plaintext = new Uint8Array(messageBuffer.byteLength);
      // TODO: figure out why we needed padding in the first place
      // this.plaintext = new Uint8Array(
      //   this.getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
      // );
      this.plaintext.set(new Uint8Array(messageBuffer));
      //this.plaintext[messageBuffer.byteLength] = 0x80;
    }
    return this.plaintext;
  },
  async wrapInWebsocketMessage(outgoingObject) {
    const messageEnvelope = new textsecure.protobuf.Envelope({
      type: outgoingObject.type,
      source: outgoingObject.address.getName(),
      sourceDevice: outgoingObject.address.getDeviceId(),
      timestamp: this.timestamp,
      content: outgoingObject.content,
    });
    const requestMessage = new textsecure.protobuf.WebSocketRequestMessage({
        id: new Uint8Array(libsignal.crypto.getRandomBytes(1))[0], // random ID for now
        verb: 'PUT',
        path: '/api/v1/message',
        body: messageEnvelope.encode().toArrayBuffer()
    });
    const websocketMessage = new textsecure.protobuf.WebSocketMessage({
      type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
      request: requestMessage
    });
    const bytes = new Uint8Array(websocketMessage.encode().toArrayBuffer())
    bytes.toString(); // print bytes for debugging purposes: can be injected in mock socket server 
    return bytes;
  },
  doSendMessage(number, deviceIds, recurse) {
    const ciphers = {};
    const plaintext = this.getPlaintext();

    return Promise.all(
      deviceIds.map(async deviceId => {
        const address = new libsignal.SignalProtocolAddress(number, deviceId);

        const ourNumber = textsecure.storage.user.getNumber();
        const options = {};

        // No limit on message keys if we're communicating with our other devices
        if (ourNumber === number) {
          options.messageKeysLimit = false;
        }

        let sessionCipher;
        if (this.fallBackEncryption) {
          sessionCipher = new libloki.FallBackSessionCipher(
            address
          );
        } else {
          sessionCipher = new libsignal.SessionCipher(
            textsecure.storage.protocol,
            address,
            options
          );
        }
        ciphers[address.getDeviceId()] = sessionCipher;
        return sessionCipher.encrypt(plaintext).then(ciphertext => {
          if (! this.fallBackEncryption)
            ciphertext.body = new Uint8Array(dcodeIO.ByteBuffer.wrap(ciphertext.body,'binary').toArrayBuffer());
          return ciphertext;
        }).then(ciphertext => ({
          type: ciphertext.type,
          address: address,
          destinationDeviceId: address.getDeviceId(),
          destinationRegistrationId: ciphertext.registrationId,
          content: ciphertext.body,
        }));
      })
    )
      .then(async outgoingObjects => {
        let promises = [];
        outgoingObjects.forEach(outgoingObject => {
          promises.push(this.wrapInWebsocketMessage(outgoingObject));
        });
        // TODO: handle multiple devices/messages per transmit
        const socketMessages = await promises[0];
        await this.transmitMessage(number, socketMessages, this.timestamp);
        this.successfulNumbers[this.successfulNumbers.length] = number;
        this.numberCompleted();
        }
      )
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
                ciphers[deviceId].closeOpenSessionForDevice()
              )
            );
          }

          return p.then(() => {
            const resetDevices =
              error.code === 410
                ? error.response.staleDevices
                : error.response.missingDevices;
            return this.getKeysForNumber(number, resetDevices).then(
              this.reloadDevicesAndSend(number, error.code === 409)
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

  sendToNumber(number) {
    return this.getStaleDeviceIdsForNumber(number).then(updateDevices =>
      this.getKeysForNumber(number, updateDevices)
        .then(async (keysFound) =>  {
          let attachPrekeys = false;
          if (!keysFound)
          {
            log.info("Fallback encryption enabled");
            this.fallBackEncryption = true;
            attachPrekeys = true;
          } else {
            try {
              const conversation = ConversationController.get(number);
              attachPrekeys = !conversation.isKeyExchangeCompleted();
            } catch(e) {
              // do nothing
            }
          }
          
          if (attachPrekeys) {
            log.info('attaching prekeys to outgoing message');
            this.message.preKeyBundleMessage = await libloki.getPreKeyBundleForNumber(number);
          }
        }).then(this.reloadDevicesAndSend(number, true))
        .catch(error => {
          if (error.message === 'Identity key changed') {
            // eslint-disable-next-line no-param-reassign
            error = new textsecure.OutgoingIdentityKeyError(
              number,
              error.originalMessage,
              error.timestamp,
              error.identityKey
            );
            this.registerError(number, 'Identity key changed', error);
          } else {
            this.registerError(
              number,
              `Failed to retrieve new device keys for number ${number}`,
              error
            );
          }
        })
    );
  },
};
