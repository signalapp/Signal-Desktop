/* global
  textsecure,
  libsignal,
  window,
  ConversationController,
  libloki,
  StringView,
  lokiMessageAPI,
  i18n,
  log
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

function _getPaddedMessageLength(messageLength) {
  const messageLengthWithTerminator = messageLength + 1;
  let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

  if (messageLengthWithTerminator % 160 !== 0) {
    messagePartCount += 1;
  }

  return messagePartCount * 160;
}

function _convertMessageToText(messageBuffer) {
  const plaintext = new Uint8Array(
    _getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
  );
  plaintext.set(new Uint8Array(messageBuffer));
  plaintext[messageBuffer.byteLength] = 0x80;

  return plaintext;
}

function _getPlaintext(messageBuffer) {
  return _convertMessageToText(messageBuffer);
}

function wrapInWebsocketMessage(outgoingObject, timestamp) {
  const source =
    outgoingObject.type ===
    textsecure.protobuf.Envelope.Type.UNIDENTIFIED_SENDER
      ? null
      : outgoingObject.ourKey;

  const messageEnvelope = new textsecure.protobuf.Envelope({
    type: outgoingObject.type,
    source,
    sourceDevice: outgoingObject.sourceDevice,
    timestamp,
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
}

function getStaleDeviceIdsForNumber(number) {
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
}

const DebugMessageType = {
  AUTO_FR_REQUEST: 'auto-friend-request',
  AUTO_FR_ACCEPT: 'auto-friend-accept',

  SESSION_REQUEST: 'session-request',
  SESSION_REQUEST_ACCEPT: 'session-request-accepted',

  SESSION_RESET: 'session-reset',
  SESSION_RESET_RECV: 'session-reset-received',

  OUTGOING_FR_ACCEPTED: 'outgoing-friend-request-accepted',
  INCOMING_FR_ACCEPTED: 'incoming-friend-request-accept',

  REQUEST_SYNC_SEND: 'request-sync-send',
  CONTACT_SYNC_SEND: 'contact-sync-send',
  CLOSED_GROUP_SYNC_SEND: 'closed-group-sync-send',
  OPEN_GROUP_SYNC_SEND: 'open-group-sync-send',

  DEVICE_UNPAIRING_SEND: 'device-unpairing-send',
  PAIRING_REQUEST_SEND: 'pairing-request',
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
    isPublic,
    isMediumGroup,
    publicSendData,
    debugMessageType,
  } =
    options || {};
  this.numberInfo = numberInfo;
  this.isPublic = isPublic;
  this.isMediumGroup = !!isMediumGroup;
  this.isGroup = !!(
    this.message &&
    this.message.dataMessage &&
    this.message.dataMessage.group
  );
  this.publicSendData = publicSendData;
  this.senderCertificate = senderCertificate;
  this.online = online;
  this.messageType = messageType || 'outgoing';
  this.debugMessageType = debugMessageType;
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
  reloadDevicesAndSend(primaryPubKey) {
    const ourNumber = textsecure.storage.user.getNumber();

    return (
      libloki.storage
        .getAllDevicePubKeysForPrimaryPubKey(primaryPubKey)
        // Don't send to ourselves
        .then(devicesPubKeys =>
          devicesPubKeys.filter(pubKey => pubKey !== ourNumber)
        )
        .then(devicesPubKeys => {
          if (devicesPubKeys.length === 0) {
            // No need to start the sending of message without a recipient
            return Promise.resolve();
          }
          return this.doSendMessage(primaryPubKey, devicesPubKeys);
        })
    );
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

  async buildMessage(devicePubKey) {
    const updatedDevices = await getStaleDeviceIdsForNumber(devicePubKey);
    const keysFound = await this.getKeysForNumber(devicePubKey, updatedDevices);

    let isMultiDeviceRequest = false;
    let thisDeviceMessageType = this.messageType;
    if (
      thisDeviceMessageType !== 'pairing-request' &&
      thisDeviceMessageType !== 'friend-request' &&
      thisDeviceMessageType !== 'onlineBroadcast'
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
    let logDetails;
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
      logDetails = {
        tempMessage,
      };
    } else {
      messageBuffer = this.message.toArrayBuffer();
      logDetails = {
        message: this.message,
      };
    }
    const messageTypeStr = this.debugMessageType;

    const ourPubKey = textsecure.storage.user.getNumber();
    const ourPrimaryPubkey = window.storage.get('primaryDevicePubKey');
    const secondaryPubKeys =
      (await window.libloki.storage.getSecondaryDevicesFor(ourPubKey)) || [];
    let aliasedPubkey = devicePubKey;
    if (devicePubKey === ourPubKey) {
      aliasedPubkey = 'OUR_PUBKEY'; // should not happen
    } else if (devicePubKey === ourPrimaryPubkey) {
      aliasedPubkey = 'OUR_PRIMARY_PUBKEY';
    } else if (secondaryPubKeys.includes(devicePubKey)) {
      aliasedPubkey = 'OUR SECONDARY PUBKEY';
    }
    libloki.api.debug.logSessionMessageSending(
      `Sending ${messageTypeStr}:${
        this.messageType
      } message to ${aliasedPubkey} details:`,
      logDetails
    );

    const plaintext = _getPlaintext(messageBuffer);

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

    const innerCiphertext = await sessionCipher.encrypt(plaintext);

    const secretSessionCipher = new window.Signal.Metadata.SecretSessionCipher(
      textsecure.storage.protocol
    );

    const senderCert = new textsecure.protobuf.SenderCertificate();

    senderCert.sender = ourKey;
    senderCert.senderDevice = deviceId;

    const ciphertext = await secretSessionCipher.encrypt(
      address.getName(),
      senderCert,
      innerCiphertext
    );
    const type = textsecure.protobuf.Envelope.Type.UNIDENTIFIED_SENDER;
    const content = window.Signal.Crypto.arrayBufferToBase64(ciphertext);

    return {
      type,
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
  async sendPublicMessage(number) {
    await this.transmitMessage(
      number,
      this.message.dataMessage,
      this.timestamp,
      0 // ttl
    );

    this.successfulNumbers[this.successfulNumbers.length] = number;
    this.numberCompleted();
  },
  async sendMediumGroupMessage(groupId) {
    const ttl = getTTLForType(this.messageType);

    const plaintext = this.message.toArrayBuffer();

    const ourIdentity = textsecure.storage.user.getNumber();

    const {
      ciphertext,
      keyIdx,
    } = await window.SenderKeyAPI.encryptWithSenderKey(
      plaintext,
      groupId,
      ourIdentity
    );

    if (!ciphertext) {
      log.error('could not encrypt for medium group');
      return;
    }

    const source = ourIdentity;

    // We should include ciphertext idx in the message
    const content = new textsecure.protobuf.MediumGroupCiphertext({
      ciphertext,
      source,
      keyIdx,
    });

    // Encrypt for the group's identity key to hide source and key idx:
    const {
      ciphertext: ciphertextOuter,
      ephemeralKey,
    } = await libloki.crypto.encryptForPubkey(
      groupId,
      content.encode().toArrayBuffer()
    );

    const contentOuter = new textsecure.protobuf.MediumGroupContent({
      ciphertext: ciphertextOuter,
      ephemeralKey,
    });

    log.debug(
      'Group ciphertext: ',
      window.Signal.Crypto.arrayBufferToBase64(ciphertext)
    );

    const outgoingObject = {
      type: textsecure.protobuf.Envelope.Type.MEDIUM_GROUP_CIPHERTEXT,
      ttl,
      ourKey: ourIdentity,
      sourceDevice: 1,
      content: contentOuter.encode().toArrayBuffer(),
      isFriendRequest: false,
      isSessionRequest: false,
    };

    // TODO: Rather than using sealed sender, we just generate a key pair, perform an ECDH against
    // the group's public key and encrypt using the derived key

    const socketMessage = wrapInWebsocketMessage(
      outgoingObject,
      this.timestamp
    );

    await this.transmitMessage(groupId, socketMessage, this.timestamp, ttl);

    this.successfulNumbers[this.successfulNumbers.length] = groupId;
    this.numberCompleted();
  },
  // Send a message to a private group member or a session chat (one to one)
  async sendSessionMessage(outgoingObjects) {
    // TODO: handle multiple devices/messages per transmit
    const promises = outgoingObjects.map(async outgoingObject => {
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
        const socketMessage = wrapInWebsocketMessage(
          outgoingObject,
          this.timestamp
        );
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
    await Promise.all(promises);
    // TODO: the retrySend should only send to the devices
    // for which the transmission failed.

    // ensure numberCompleted() will execute the callback
    this.numbersCompleted += this.errors.length + this.successfulNumbers.length;
    // Absorb errors if message sent to at least 1 device
    if (this.successfulNumbers.length > 0) {
      this.errors = [];
    }
    this.numberCompleted();
  },
  async buildAndEncrypt(devicePubKey) {
    const clearMessage = await this.buildMessage(devicePubKey);
    return this.encryptMessage(clearMessage);
  },
  // eslint-disable-next-line no-unused-vars
  async doSendMessage(primaryPubKey, devicesPubKeys) {
    if (this.isPublic) {
      await this.sendPublicMessage(primaryPubKey);
      return;
    }
    this.numbers = devicesPubKeys;

    if (this.isMediumGroup) {
      await this.sendMediumGroupMessage(primaryPubKey);
      return;
    }

    const outgoingObjects = await Promise.all(
      devicesPubKeys.map(pk => this.buildAndEncrypt(pk, primaryPubKey))
    );

    this.sendSessionMessage(outgoingObjects);
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
    return this.reloadDevicesAndSend(number).catch(error => {
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

OutgoingMessage.buildAutoFriendRequestMessage = function buildAutoFriendRequestMessage(
  pubKey
) {
  const dataMessage = new textsecure.protobuf.DataMessage({});

  const content = new textsecure.protobuf.Content({
    dataMessage,
  });

  const options = {
    messageType: 'onlineBroadcast',
    debugMessageType: DebugMessageType.AUTO_FR_REQUEST,
  };
  // Send a empty message with information about how to contact us directly
  return new OutgoingMessage(
    null, // server
    Date.now(), // timestamp,
    [pubKey], // numbers
    content, // message
    true, // silent
    () => null, // callback
    options
  );
};

OutgoingMessage.buildSessionRequestMessage = function buildSessionRequestMessage(
  pubKey
) {
  const body =
    '(If you see this message, you must be using an out-of-date client)';
  const flags = textsecure.protobuf.DataMessage.Flags.SESSION_REQUEST;

  const dataMessage = new textsecure.protobuf.DataMessage({ body, flags });

  const content = new textsecure.protobuf.Content({
    dataMessage,
  });

  const options = {
    messageType: 'friend-request',
    debugMessageType: DebugMessageType.SESSION_REQUEST,
  };
  // Send a empty message with information about how to contact us directly
  return new OutgoingMessage(
    null, // server
    Date.now(), // timestamp,
    [pubKey], // numbers
    content, // message
    true, // silent
    () => null, // callback
    options
  );
};

OutgoingMessage.buildBackgroundMessage = function buildBackgroundMessage(
  pubKey,
  debugMessageType
) {
  const p2pAddress = null;
  const p2pPort = null;
  // We result loki address message for sending "background" messages
  const type = textsecure.protobuf.LokiAddressMessage.Type.HOST_UNREACHABLE;

  // This is needed even if LokiAddressMessage shouldn't be used.
  // looks like the message is not sent or dropped on reception
  // if the content is completely empty
  const lokiAddressMessage = new textsecure.protobuf.LokiAddressMessage({
    p2pAddress,
    p2pPort,
    type,
  });
  const content = new textsecure.protobuf.Content({ lokiAddressMessage });

  const options = { messageType: 'onlineBroadcast', debugMessageType };
  // Send a empty message with information about how to contact us directly
  return new OutgoingMessage(
    null, // server
    Date.now(), // timestamp,
    [pubKey], // numbers
    content, // message
    true, // silent
    () => null, // callback
    options
  );
};

OutgoingMessage.buildUnpairingMessage = function buildUnpairingMessage(pubKey) {
  const flags = textsecure.protobuf.DataMessage.Flags.UNPAIRING_REQUEST;
  const dataMessage = new textsecure.protobuf.DataMessage({
    flags,
  });
  const content = new textsecure.protobuf.Content({
    dataMessage,
  });
  const debugMessageType = DebugMessageType.DEVICE_UNPAIRING_SEND;
  const options = { messageType: 'device-unpairing', debugMessageType };
  const outgoingMessage = new textsecure.OutgoingMessage(
    null, // server
    Date.now(), // timestamp,
    [pubKey], // numbers
    content, // message
    true, // silent
    () => null, // callback
    options
  );
  return outgoingMessage;
};

OutgoingMessage.buildPairingRequestMessage = function buildPairingRequestMessage(
  pubKey,
  ourNumber,
  ourConversation,
  authorisation,
  pairingAuthorisation,
  callback
) {
  const content = new textsecure.protobuf.Content({
    pairingAuthorisation,
  });
  const isGrant = authorisation.primaryDevicePubKey === ourNumber;
  if (isGrant) {
    // Send profile name to secondary device
    const lokiProfile = ourConversation.getLokiProfile();
    // profile.avatar is the path to the local image
    // replace with the avatar URL
    const avatarPointer = ourConversation.get('avatarPointer');
    lokiProfile.avatar = avatarPointer;
    const profile = new textsecure.protobuf.DataMessage.LokiProfile(
      lokiProfile
    );
    const profileKey = window.storage.get('profileKey');
    const dataMessage = new textsecure.protobuf.DataMessage({
      profile,
      profileKey,
    });
    content.dataMessage = dataMessage;
  }

  const debugMessageType = DebugMessageType.PAIRING_REQUEST_SEND;
  const options = { messageType: 'pairing-request', debugMessageType };
  const outgoingMessage = new textsecure.OutgoingMessage(
    null, // server
    Date.now(), // timestamp,
    [pubKey], // numbers
    content, // message
    true, // silent
    callback, // callback
    options
  );
  return outgoingMessage;
};

OutgoingMessage.DebugMessageType = DebugMessageType;

window.textsecure = window.textsecure || {};
window.textsecure.OutgoingMessage = OutgoingMessage;
