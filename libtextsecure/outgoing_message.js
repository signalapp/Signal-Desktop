/* global
  textsecure,
  libsignal,
  window,
  ConversationController,
  libloki,
  StringView,
  lokiMessageAPI,
  i18n,
*/

/* eslint-disable more/no-then */
/* eslint-disable no-unreachable */
const NUM_SEND_CONNECTIONS = 3;

const getTTLForType = type => {
  switch (type) {
    case 'friend-request':
      return 4 * 24 * 60 * 60 * 1000; // 4 days for friend request message
    case 'device-unpairing':
      return 4 * 24 * 60 * 60 * 1000; // 4 days for device unpairing
    case 'onlineBroadcast':
      return 60 * 1000; // 1 minute for online broadcast message
    case 'typing':
      return 60 * 1000; // 1 minute for typing indicators
    case 'pairing-request':
      return 2 * 60 * 1000; // 2 minutes for pairing requests
    default:
      return (window.getMessageTTL() || 24) * 60 * 60 * 1000; // 1 day default for any other message
  }
};

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
  this.fallBackEncryption = false;
  this.failoverNumbers = [];
  this.unidentifiedDeliveries = [];

  const {
    numberInfo,
    senderCertificate,
    online,
    messageType,
    isPing,
    isPublic,
    publicSendData,
  } =
    options || {};
  this.numberInfo = numberInfo;
  this.isPublic = isPublic;
  this.isGroup = !!(
    this.message &&
    this.message.dataMessage &&
    this.message.dataMessage.group
  );
  this.publicSendData = publicSendData;
  this.senderCertificate = senderCertificate;
  this.online = online;
  this.messageType = messageType || 'outgoing';
  this.isPing = isPing || false;
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
        messageType: this.messageType,
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
    const ourNumber = textsecure.storage.user.getNumber();
    return () =>
      libloki.storage
        .getAllDevicePubKeysForPrimaryPubKey(number)
        // Don't send to ourselves
        .then(devicesPubKeys =>
          devicesPubKeys.filter(pubKey => pubKey !== ourNumber)
        )
        .then(devicesPubKeys => {
          if (devicesPubKeys.length === 0) {
            // eslint-disable-next-line no-param-reassign
            devicesPubKeys = [number];
          }
          return this.doSendMessage(number, devicesPubKeys, recurse);
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
            return builder
              .processPreKey(device)
              .then(async () => {
                // TODO: only remove the keys that were used above!
                await libloki.storage.removeContactPreKeyBundle(number);
                return true;
              })
              .catch(error => {
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

          return false;
        })
      );
    let promise = Promise.resolve(true);
    updateDevices.forEach(device => {
      promise = promise.then(() =>
        Promise.all([
          textsecure.storage.protocol.loadContactPreKey(number),
          textsecure.storage.protocol.loadContactSignedPreKey(number),
        ])
          .then(keys => {
            const [preKey, signedPreKey] = keys;
            if (preKey === undefined || signedPreKey === undefined) {
              return false;
            }
            const identityKey = StringView.hexToArrayBuffer(number);
            return handleResult({
              identityKey,
              devices: [
                { deviceId: device, preKey, signedPreKey, registrationId: 0 },
              ],
            }).then(results => results.every(value => value === true));
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

  // Default ttl to 24 hours if no value provided
  async transmitMessage(number, data, timestamp, ttl = 24 * 60 * 60 * 1000) {
    const pubKey = number;

    try {
      // TODO: Make NUM_CONCURRENT_CONNECTIONS a global constant
      const options = {
        numConnections: NUM_SEND_CONNECTIONS,
        isPing: this.isPing,
      };
      options.isPublic = this.isPublic;
      if (this.isPublic) {
        options.publicSendData = this.publicSendData;
      }
      await lokiMessageAPI.sendMessage(pubKey, data, timestamp, ttl, options);
    } catch (e) {
      if (e.name === 'HTTPError' && (e.code !== 409 && e.code !== 410)) {
        // 409 and 410 should bubble and be handled by doSendMessage
        // 404 should throw UnregisteredUserError
        // all other network errors can be retried later.
        if (e.code === 404) {
          throw new textsecure.UnregisteredUserError(number, e);
        }
        throw new textsecure.SendMessageNetworkError(number, '', e, timestamp);
      } else if (e.name === 'TimedOutError') {
        throw new textsecure.PoWError(number, e);
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
  convertMessageToText(messageBuffer) {
    const plaintext = new Uint8Array(
      this.getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
    );
    plaintext.set(new Uint8Array(messageBuffer));
    plaintext[messageBuffer.byteLength] = 0x80;

    return plaintext;
  },
  getPlaintext(messageBuffer) {
    return this.convertMessageToText(messageBuffer);
  },
  async wrapInWebsocketMessage(outgoingObject) {
    const source =
      outgoingObject.type ===
      textsecure.protobuf.Envelope.Type.UNIDENTIFIED_SENDER
        ? null
        : outgoingObject.ourKey;

    const messageEnvelope = new textsecure.protobuf.Envelope({
      type: outgoingObject.type,
      source,
      sourceDevice: outgoingObject.sourceDevice,
      timestamp: this.timestamp,
      content: outgoingObject.content,
    });
    const requestMessage = new textsecure.protobuf.WebSocketRequestMessage({
      id: new Uint8Array(libsignal.crypto.getRandomBytes(1))[0], // random ID for now
      verb: 'PUT',
      path: '/api/v1/message',
      body: messageEnvelope.encode().toArrayBuffer(),
    });
    const websocketMessage = new textsecure.protobuf.WebSocketMessage({
      type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
      request: requestMessage,
    });
    const bytes = new Uint8Array(websocketMessage.encode().toArrayBuffer());
    return bytes;
  },

  async buildMessage(devicePubKey) {
    const updatedDevices = await this.getStaleDeviceIdsForNumber(devicePubKey);
    const keysFound = await this.getKeysForNumber(devicePubKey, updatedDevices);

    let isMultiDeviceRequest = false;
    let thisDeviceMessageType = this.messageType;
    if (
      thisDeviceMessageType !== 'pairing-request' &&
      thisDeviceMessageType !== 'friend-request'
    ) {
      try {
        const conversation = ConversationController.get(devicePubKey);
        if (conversation && !this.isGroup) {
          const isOurDevice = await conversation.isOurDevice();
          const isFriends =
            conversation.isFriend() || conversation.hasReceivedFriendRequest();
          // We should only send a friend request to our device if we don't have keys
          const shouldSendAutomatedFR = isOurDevice ? !keysFound : !isFriends;
          if (shouldSendAutomatedFR) {
            // We want to send an automated friend request if:
            // - We aren't already friends
            // - We haven't received a friend request from this device
            // - We haven't sent a friend request recently
            if (conversation.friendRequestTimerIsExpired()) {
              isMultiDeviceRequest = true;
              thisDeviceMessageType = 'friend-request';
            } else {
              // Throttle automated friend requests
              this.successfulNumbers.push(devicePubKey);
              return null;
            }
          }

          // If we're not friends with our own device then we should become friends
          if (isOurDevice && keysFound && !isFriends) {
            conversation.setFriendRequestStatus(
              window.friends.friendRequestStatusEnum.friends
            );
          }
        }
      } catch (e) {
        // do nothing
      }
    }

    // Check if we need to attach the preKeys
    const enableFallBackEncryption =
      !keysFound || thisDeviceMessageType === 'friend-request';
    const flags = this.message.dataMessage
      ? this.message.dataMessage.get_flags()
      : null;
    // END_SESSION means Session reset message
    const isEndSession =
      flags === textsecure.protobuf.DataMessage.Flags.END_SESSION;
    const isSessionRequest =
      flags === textsecure.protobuf.DataMessage.Flags.SESSION_REQUEST;

    if (enableFallBackEncryption || isEndSession) {
      // Encrypt them with the fallback
      const pkb = await libloki.storage.getPreKeyBundleForContact(devicePubKey);
      this.message.preKeyBundleMessage = new textsecure.protobuf.PreKeyBundleMessage(
        pkb
      );
      window.log.info('attaching prekeys to outgoing message');
    }

    let messageBuffer;
    if (isMultiDeviceRequest) {
      const tempMessage = new textsecure.protobuf.Content();
      const tempDataMessage = new textsecure.protobuf.DataMessage();
      tempDataMessage.body = i18n('secondaryDeviceDefaultFR');
      if (this.message.dataMessage && this.message.dataMessage.profile) {
        tempDataMessage.profile = this.message.dataMessage.profile;
      }
      tempMessage.preKeyBundleMessage = this.message.preKeyBundleMessage;
      tempMessage.dataMessage = tempDataMessage;
      messageBuffer = tempMessage.toArrayBuffer();
    } else {
      messageBuffer = this.message.toArrayBuffer();
    }

    const plaintext = this.getPlaintext(messageBuffer);

    // No limit on message keys if we're communicating with our other devices
    // FIXME options not used at all; if (ourPubkey === number) {
    //   options.messageKeysLimit = false;
    // }
    const ttl = getTTLForType(thisDeviceMessageType);
    const ourKey = textsecure.storage.user.getNumber();

    return {
      ttl,
      ourKey,
      sourceDevice: 1,
      plaintext,
      pubKey: devicePubKey,
      isFriendRequest: enableFallBackEncryption,
      isSessionRequest,
      enableFallBackEncryption,
    };
  },

  async encryptMessage(clearMessage) {
    if (clearMessage === null) {
      window.log.warn(
        'clearMessage is null on encryptMessage... Returning null'
      );
      return null;
    }
    const {
      ttl,
      ourKey,
      sourceDevice,
      plaintext,
      pubKey,
      isSessionRequest,
      enableFallBackEncryption,
    } = clearMessage;
    // Session doesn't use the deviceId scheme, it's always 1.
    // Instead, there are multiple device public keys.
    const deviceId = 1;

    const address = new libsignal.SignalProtocolAddress(pubKey, deviceId);

    let sessionCipher;

    if (enableFallBackEncryption) {
      sessionCipher = new libloki.crypto.FallBackSessionCipher(address);
    } else {
      sessionCipher = new libsignal.SessionCipher(
        textsecure.storage.protocol,
        address
      );
    }

    const secretSessionCipher = new window.Signal.Metadata.SecretSessionCipher(
      textsecure.storage.protocol
    );
    // ciphers[address.getDeviceId()] = secretSessionCipher;

    const senderCert = new textsecure.protobuf.SenderCertificate();

    senderCert.sender = ourKey;
    senderCert.senderDevice = deviceId;

    const ciphertext = await secretSessionCipher.encrypt(
      address,
      senderCert,
      plaintext,
      sessionCipher
    );
    const type = textsecure.protobuf.Envelope.Type.UNIDENTIFIED_SENDER;
    const content = window.Signal.Crypto.arrayBufferToBase64(ciphertext);

    return {
      type, // FallBackSessionCipher sets this to FRIEND_REQUEST
      ttl,
      ourKey,
      sourceDevice,
      content,
      pubKey,
      isFriendRequest: enableFallBackEncryption,
      isSessionRequest,
    };
  },
  // Send a message to a public group
  sendPublicMessage(number) {
    return this.transmitMessage(
      number,
      this.message.dataMessage,
      this.timestamp,
      0 // ttl
    )
      .then(() => {
        this.successfulNumbers[this.successfulNumbers.length] = number;
        this.numberCompleted();
      })
      .catch(error => {
        throw error;
      });
  },
  // Send a message to a private group or a session chat (one to one)
  async sendSessionMessage(outgoingObjects) {
    // TODO: handle multiple devices/messages per transmit
    const promises = outgoingObjects.map(outgoingObject => async () => {
      if (!outgoingObject) {
        return;
      }
      const {
        pubKey: destination,
        ttl,
        isFriendRequest,
        isSessionRequest,
      } = outgoingObject;
      try {
        const socketMessage = await this.wrapInWebsocketMessage(outgoingObject);

        await this.transmitMessage(
          destination,
          socketMessage,
          this.timestamp,
          ttl
        );

        if (!this.isGroup && isFriendRequest && !isSessionRequest) {
          const conversation = ConversationController.get(destination);
          if (conversation) {
            // Redundant for primary device but marks secondary devices as pending
            await conversation.onFriendRequestSent();
          }
        }
        this.successfulNumbers.push(destination);
      } catch (e) {
        e.number = destination;
        this.errors.push(e);
      }
    });

    await Promise.all(promises.map(f => f()));

    this.numbersCompleted += this.successfulNumbers.length;
    this.numberCompleted();
  },
  async buildAndEncrypt(devicePubKey) {
    const clearMessage = await this.buildMessage(devicePubKey);
    return this.encryptMessage(clearMessage);
  },
  // eslint-disable-next-line no-unused-vars
  doSendMessage(number, devicesPubKeys, recurse) {
    if (this.isPublic) {
      return this.sendPublicMessage(number);
    }
    this.numbers = devicesPubKeys;

    return Promise.all(
      devicesPubKeys.map(devicePubKey => this.buildAndEncrypt(devicePubKey))
    )
      .then(outgoingObjects => this.sendSessionMessage(outgoingObjects))
      .catch(error => {
        // TODO(loki): handle http errors properly
        // - retry later if 400
        // - ignore if 409 (conflict) means the hash already exists
        throw error;
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
    let conversation;
    try {
      conversation = ConversationController.get(number);
    } catch (e) {
      // do nothing
    }
    return this.reloadDevicesAndSend(number, true)().catch(error => {
      conversation.resetPendingSend();
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
    });
  },
};

window.textsecure = window.textsecure || {};
window.textsecure.OutgoingMessage = OutgoingMessage;
