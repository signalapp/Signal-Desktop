/* global dcodeIO: false */
/* global Backbone: false */
/* global Whisper: false */
/* global _: false */
/* global libsignal: false */
/* global textsecure: false */
/* global ConversationController: false */
/* global wrapDeferred: false */
/* global stringObject: false */

/* eslint-disable more/no-then, no-proto */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  const TIMESTAMP_THRESHOLD = 5 * 1000; // 5 seconds
  const Direction = {
    SENDING: 1,
    RECEIVING: 2,
  };

  const VerifiedStatus = {
    DEFAULT: 0,
    VERIFIED: 1,
    UNVERIFIED: 2,
  };

  function validateVerifiedStatus(status) {
    if (
      status === VerifiedStatus.DEFAULT ||
      status === VerifiedStatus.VERIFIED ||
      status === VerifiedStatus.UNVERIFIED
    ) {
      return true;
    }
    return false;
  }

  const StaticByteBufferProto = new dcodeIO.ByteBuffer().__proto__;
  const StaticArrayBufferProto = new ArrayBuffer().__proto__;
  const StaticUint8ArrayProto = new Uint8Array().__proto__;

  function isStringable(thing) {
    return (
      thing === Object(thing) &&
      (thing.__proto__ === StaticArrayBufferProto ||
        thing.__proto__ === StaticUint8ArrayProto ||
        thing.__proto__ === StaticByteBufferProto)
    );
  }
  function convertToArrayBuffer(thing) {
    if (thing === undefined) {
      return undefined;
    }
    if (thing === Object(thing)) {
      if (thing.__proto__ === StaticArrayBufferProto) {
        return thing;
      }
      // TODO: Several more cases here...
    }

    if (thing instanceof Array) {
      // Assuming Uint16Array from curve25519
      const res = new ArrayBuffer(thing.length * 2);
      const uint = new Uint16Array(res);
      for (let i = 0; i < thing.length; i += 1) {
        uint[i] = thing[i];
      }
      return res;
    }

    let str;
    if (isStringable(thing)) {
      str = stringObject(thing);
    } else if (typeof thing === 'string') {
      str = thing;
    } else {
      throw new Error(
        `Tried to convert a non-stringable thing of type ${typeof thing} to an array buffer`
      );
    }
    const res = new ArrayBuffer(str.length);
    const uint = new Uint8Array(res);
    for (let i = 0; i < str.length; i += 1) {
      uint[i] = str.charCodeAt(i);
    }
    return res;
  }

  function equalArrayBuffers(ab1, ab2) {
    if (!(ab1 instanceof ArrayBuffer && ab2 instanceof ArrayBuffer)) {
      return false;
    }
    if (ab1.byteLength !== ab2.byteLength) {
      return false;
    }
    let result = 0;
    const ta1 = new Uint8Array(ab1);
    const ta2 = new Uint8Array(ab2);
    for (let i = 0; i < ab1.byteLength; i += 1) {
      // eslint-disable-next-line no-bitwise
      result |= ta1[i] ^ ta2[i];
    }
    return result === 0;
  }

  const Model = Backbone.Model.extend({ database: Whisper.Database });
  const PreKey = Model.extend({ storeName: 'preKeys' });
  const PreKeyCollection = Backbone.Collection.extend({
    storeName: 'preKeys',
    database: Whisper.Database,
    model: PreKey,
  });
  const SignedPreKey = Model.extend({ storeName: 'signedPreKeys' });
  const SignedPreKeyCollection = Backbone.Collection.extend({
    storeName: 'signedPreKeys',
    database: Whisper.Database,
    model: SignedPreKey,
  });
  const Session = Model.extend({ storeName: 'sessions' });
  const SessionCollection = Backbone.Collection.extend({
    storeName: 'sessions',
    database: Whisper.Database,
    model: Session,
    fetchSessionsForNumber(number) {
      return this.fetch({ range: [`${number}.1`, `${number}.:`] });
    },
  });
  const Unprocessed = Model.extend();
  const IdentityRecord = Model.extend({
    storeName: 'identityKeys',
    validAttributes: [
      'id',
      'publicKey',
      'firstUse',
      'timestamp',
      'verified',
      'nonblockingApproval',
    ],
    validate(attrs) {
      const attributeNames = _.keys(attrs);
      const { validAttributes } = this;
      const allValid = _.all(attributeNames, attributeName =>
        _.contains(validAttributes, attributeName)
      );
      if (!allValid) {
        return new Error('Invalid identity key attribute names');
      }
      const allPresent = _.all(validAttributes, attributeName =>
        _.contains(attributeNames, attributeName)
      );
      if (!allPresent) {
        return new Error('Missing identity key attributes');
      }

      if (typeof attrs.id !== 'string') {
        return new Error('Invalid identity key id');
      }
      if (!(attrs.publicKey instanceof ArrayBuffer)) {
        return new Error('Invalid identity key publicKey');
      }
      if (typeof attrs.firstUse !== 'boolean') {
        return new Error('Invalid identity key firstUse');
      }
      if (typeof attrs.timestamp !== 'number' || !(attrs.timestamp >= 0)) {
        return new Error('Invalid identity key timestamp');
      }
      if (!validateVerifiedStatus(attrs.verified)) {
        return new Error('Invalid identity key verified');
      }
      if (typeof attrs.nonblockingApproval !== 'boolean') {
        return new Error('Invalid identity key nonblockingApproval');
      }

      return null;
    },
  });
  const Group = Model.extend({ storeName: 'groups' });
  const Item = Model.extend({ storeName: 'items' });
  const ContactPreKey = Model.extend({ storeName: 'contactPreKeys' });
  const ContactSignedPreKey = Model.extend({ storeName: 'contactSignedPreKeys' });

  function SignalProtocolStore() {}

  SignalProtocolStore.prototype = {
    constructor: SignalProtocolStore,
    getIdentityKeyPair() {
      const item = new Item({ id: 'identityKey' });
      return new Promise((resolve, reject) => {
        item.fetch().then(() => {
          resolve(item.get('value'));
        }, reject);
      });
    },
    getLocalRegistrationId() {
      return Promise.resolve(1);
      /*
      const item = new Item({ id: 'registrationId' });
      return new Promise((resolve, reject) => {
        item.fetch().then(() => {
          resolve(item.get('value'));
        }, reject);
      });*/
    },

    /* Returns a prekeypair object or undefined */
    loadPreKey(keyId) {
      const prekey = new PreKey({ id: keyId });
      return new Promise(resolve => {
        prekey.fetch().then(
          () => {
            window.log.info('Successfully fetched prekey:', keyId);
            resolve({
              pubKey: prekey.get('publicKey'),
              privKey: prekey.get('privateKey'),
            });
          },
          () => {
            window.log.error('Failed to fetch prekey:', keyId);
            resolve();
          }
        );
      });
    },
    loadPreKeyForContactIdentityKeyString(contactIdentityKeyString) {
      const prekey = new PreKey({ recipient: contactIdentityKeyString });
      return new Promise(resolve => {
        prekey.fetch().then(
          () => {
            window.log.info('Successfully fetched prekey for recipient :', contactIdentityKeyString);
            resolve({
              pubKey: prekey.get('publicKey'),
              privKey: prekey.get('privateKey'),
              keyId: prekey.get('id'),
            });
          },
          () => {
            resolve();
          }
        );
      });
    },
    loadContactPreKey(pubKey) {
      const prekey = new ContactPreKey({ identityKeyString: pubKey });
      return new Promise(resolve => {
        prekey.fetch().then(
          () => {
            window.log.info('Successfully fetched contact prekey:', pubKey);
            resolve({
              id: prekey.get('id'),
              keyId: prekey.get('keyId'),
              publicKey: prekey.get('publicKey'),
              identityKeyString: prekey.get('identityKeyString'),
            });
          },
          () => {
            window.log.error('Failed to fetch contact prekey:', pubKey);
            resolve();
          }
        );
      });
    },
    storeContactPreKey(pubKey, preKey) {
      const prekey = new ContactPreKey({
        // id: (autoincrement)
        identityKeyString: pubKey,
        publicKey: preKey.publicKey,
        keyId: preKey.keyId,
      });
      return new Promise(resolve => {
        prekey.save().always(() => {
          resolve();
        });
      });
    },
    storePreKey(keyId, keyPair, contactIdentityKeyString) {
      const prekey = new PreKey({
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
        recipient: contactIdentityKeyString,
      });
      return new Promise(resolve => {
        prekey.save().always(() => {
          resolve();
        });
      });
    },
    removePreKey(keyId) {
      const prekey = new PreKey({ id: keyId });

      this.trigger('removePreKey');

      return new Promise(resolve => {
        const deferred = prekey.destroy();
        if (!deferred) {
          return resolve();
        }

        return deferred.then(resolve, error => {
          window.log.error(
            'removePreKey error:',
            error && error.stack ? error.stack : error
          );
          resolve();
        });
      });
    },
    clearPreKeyStore() {
      return new Promise(resolve => {
        const preKeys = new PreKeyCollection();
        preKeys.sync('delete', preKeys, {}).always(resolve);
      });
    },

    /* Returns a signed keypair object or undefined */
    loadSignedPreKey(keyId) {
      const prekey = new SignedPreKey({ id: keyId });
      return new Promise(resolve => {
        prekey
          .fetch()
          .then(() => {
            window.log.info(
              'Successfully fetched signed prekey:',
              prekey.get('id')
            );
            resolve({
              pubKey: prekey.get('publicKey'),
              privKey: prekey.get('privateKey'),
              created_at: prekey.get('created_at'),
              keyId: prekey.get('id'),
              confirmed: prekey.get('confirmed'),
              signature: prekey.get('signature'),
            });
          })
          .fail(() => {
            window.log.error('Failed to fetch signed prekey:', keyId);
            resolve();
          });
      });
    },
    loadContactSignedPreKey(pubKey) {
      const prekey = new ContactSignedPreKey({ identityKeyString: pubKey });
      return new Promise(resolve => {
        prekey
          .fetch()
          .then(() => {
            window.log.info(
              'Successfully fetched signed prekey:',
              prekey.get('id')
            );
            resolve({
              id: prekey.get('id'),
              identityKeyString: prekey.get('identityKeyString'),
              publicKey: prekey.get('publicKey'),
              signature: prekey.get('signature'),
              created_at: prekey.get('created_at'),
              keyId: prekey.get('keyId'),
              confirmed: prekey.get('confirmed'),
            });
          })
          .fail(() => {
            window.log.error('Failed to fetch signed prekey:', pubKey);
            resolve();
          });
      });
    },
    loadSignedPreKeys() {
      if (arguments.length > 0) {
        return Promise.reject(
          new Error('loadSignedPreKeys takes no arguments')
        );
      }
      const signedPreKeys = new SignedPreKeyCollection();
      return new Promise(resolve => {
        signedPreKeys.fetch().then(() => {
          resolve(
            signedPreKeys.map(prekey => ({
              pubKey: prekey.get('publicKey'),
              privKey: prekey.get('privateKey'),
              created_at: prekey.get('created_at'),
              keyId: prekey.get('id'),
              confirmed: prekey.get('confirmed'),
              signature: prekey.get('signature'),
            }))
          );
        });
      });
    },
    storeSignedPreKey(keyId, keyPair, confirmed, signature) {
      const prekey = new SignedPreKey({
        id: keyId,
        publicKey: keyPair.pubKey,
        privateKey: keyPair.privKey,
        created_at: Date.now(),
        confirmed: Boolean(confirmed),
        signature,
      });
      return new Promise(resolve => {
        prekey.save().always(() => {
          resolve();
        });
      });
    },
    storeContactSignedPreKey(pubKey, signedPreKey) {
      const prekey = new ContactSignedPreKey({
        // id: (autoincrement)
        identityKeyString: pubKey,
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
        created_at: Date.now(),
        confirmed: false,
      });
      return new Promise(resolve => {
        prekey.save().always(() => {
          resolve();
        });
      });
    },
    removeSignedPreKey(keyId) {
      const prekey = new SignedPreKey({ id: keyId });
      return new Promise((resolve, reject) => {
        const deferred = prekey.destroy();
        if (!deferred) {
          return resolve();
        }

        return deferred.then(resolve, reject);
      });
    },
    clearSignedPreKeysStore() {
      return new Promise(resolve => {
        const signedPreKeys = new SignedPreKeyCollection();
        signedPreKeys.sync('delete', signedPreKeys, {}).always(resolve);
      });
    },

    loadSession(encodedNumber) {
      if (encodedNumber === null || encodedNumber === undefined) {
        throw new Error('Tried to get session for undefined/null number');
      }
      return new Promise(resolve => {
        const session = new Session({ id: encodedNumber });
        session.fetch().always(() => {
          resolve(session.get('record'));
        });
      });
    },
    storeSession(encodedNumber, record) {
      if (encodedNumber === null || encodedNumber === undefined) {
        throw new Error('Tried to put session for undefined/null number');
      }
      return new Promise(resolve => {
        const number = textsecure.utils.unencodeNumber(encodedNumber)[0];
        const deviceId = parseInt(
          textsecure.utils.unencodeNumber(encodedNumber)[1],
          10
        );

        const session = new Session({ id: encodedNumber });
        session.fetch().always(() => {
          session
            .save({
              record,
              deviceId,
              number,
            })
            .fail(e => {
              window.log.error('Failed to save session', encodedNumber, e);
            })
            .always(() => {
              resolve();
            });
        });
      });
    },
    getDeviceIds(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to get device ids for undefined/null number');
      }
      return new Promise(resolve => {
        const sessions = new SessionCollection();
        sessions.fetchSessionsForNumber(number).always(() => {
          resolve(sessions.pluck('deviceId'));
        });
      });
    },
    removeSession(encodedNumber) {
      window.log.info('deleting session for ', encodedNumber);
      return new Promise(resolve => {
        const session = new Session({ id: encodedNumber });
        session
          .fetch()
          .then(() => {
            session.destroy().then(resolve);
          })
          .fail(resolve);
      });
    },
    removeAllSessions(number) {
      if (number === null || number === undefined) {
        throw new Error('Tried to remove sessions for undefined/null number');
      }
      return new Promise((resolve, reject) => {
        const sessions = new SessionCollection();
        sessions.fetchSessionsForNumber(number).always(() => {
          const promises = [];
          while (sessions.length > 0) {
            promises.push(
              new Promise((res, rej) => {
                sessions
                  .pop()
                  .destroy()
                  .then(res, rej);
              })
            );
          }
          Promise.all(promises).then(resolve, reject);
        });
      });
    },
    archiveSiblingSessions(identifier) {
      const address = libsignal.SignalProtocolAddress.fromString(identifier);
      return this.getDeviceIds(address.getName()).then(deviceIds => {
        const siblings = _.without(deviceIds, address.getDeviceId());
        return Promise.all(
          siblings.map(deviceId => {
            const sibling = new libsignal.SignalProtocolAddress(
              address.getName(),
              deviceId
            );
            window.log.info('closing session for', sibling.toString());
            const sessionCipher = new libsignal.SessionCipher(
              textsecure.storage.protocol,
              sibling
            );
            return sessionCipher.closeOpenSessionForDevice();
          })
        );
      });
    },
    archiveAllSessions(number) {
      return this.getDeviceIds(number).then(deviceIds =>
        Promise.all(
          deviceIds.map(deviceId => {
            const address = new libsignal.SignalProtocolAddress(
              number,
              deviceId
            );
            window.log.info('closing session for', address.toString());
            const sessionCipher = new libsignal.SessionCipher(
              textsecure.storage.protocol,
              address
            );
            return sessionCipher.closeOpenSessionForDevice();
          })
        )
      );
    },
    clearSessionStore() {
      return new Promise(resolve => {
        const sessions = new SessionCollection();
        sessions.sync('delete', sessions, {}).always(resolve);
      });
    },
    isTrustedIdentity(identifier, publicKey, direction) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to get identity key for undefined/null key');
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      const isOurNumber = number === textsecure.storage.user.getNumber();
      const identityRecord = new IdentityRecord({ id: number });
      return new Promise(resolve => {
        identityRecord.fetch().always(resolve);
      }).then(() => {
        const existing = identityRecord.get('publicKey');

        if (isOurNumber) {
          return equalArrayBuffers(existing, publicKey);
        }

        switch (direction) {
          case Direction.SENDING:
            return this.isTrustedForSending(publicKey, identityRecord);
          case Direction.RECEIVING:
            return true;
          default:
            throw new Error(`Unknown direction: ${direction}`);
        }
      });
    },
    isTrustedForSending(publicKey, identityRecord) {
      const existing = identityRecord.get('publicKey');

      if (!existing) {
        window.log.info('isTrustedForSending: Nothing here, returning true...');
        return true;
      }
      if (!equalArrayBuffers(existing, publicKey)) {
        window.log.info("isTrustedForSending: Identity keys don't match...");
        return false;
      }
      if (identityRecord.get('verified') === VerifiedStatus.UNVERIFIED) {
        window.log.error('Needs unverified approval!');
        return false;
      }
      if (this.isNonBlockingApprovalRequired(identityRecord)) {
        window.log.error('isTrustedForSending: Needs non-blocking approval!');
        return false;
      }

      return true;
    },
    loadIdentityKey(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to get identity key for undefined/null key');
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      return new Promise(resolve => {
        const identityRecord = new IdentityRecord({ id: number });
        identityRecord.fetch().always(() => {
          resolve(identityRecord.get('publicKey'));
        });
      });
    },
    saveIdentity(identifier, publicKey, nonblockingApproval) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to put identity key for undefined/null key');
      }
      if (!(publicKey instanceof ArrayBuffer)) {
        // eslint-disable-next-line no-param-reassign
        publicKey = convertToArrayBuffer(publicKey);
      }
      if (typeof nonblockingApproval !== 'boolean') {
        // eslint-disable-next-line no-param-reassign
        nonblockingApproval = false;
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: number });
        identityRecord.fetch().always(() => {
          const oldpublicKey = identityRecord.get('publicKey');
          if (!oldpublicKey) {
            // Lookup failed, or the current key was removed, so save this one.
            window.log.info('Saving new identity...');
            identityRecord
              .save({
                publicKey,
                firstUse: true,
                timestamp: Date.now(),
                verified: VerifiedStatus.DEFAULT,
                nonblockingApproval,
              })
              .then(() => {
                resolve(false);
              }, reject);
          } else if (!equalArrayBuffers(oldpublicKey, publicKey)) {
            window.log.info('Replacing existing identity...');
            const previousStatus = identityRecord.get('verified');
            let verifiedStatus;
            if (
              previousStatus === VerifiedStatus.VERIFIED ||
              previousStatus === VerifiedStatus.UNVERIFIED
            ) {
              verifiedStatus = VerifiedStatus.UNVERIFIED;
            } else {
              verifiedStatus = VerifiedStatus.DEFAULT;
            }
            identityRecord
              .save({
                publicKey,
                firstUse: false,
                timestamp: Date.now(),
                verified: verifiedStatus,
                nonblockingApproval,
              })
              .then(() => {
                this.trigger('keychange', number);
                this.archiveSiblingSessions(identifier).then(() => {
                  resolve(true);
                }, reject);
              }, reject);
          } else if (this.isNonBlockingApprovalRequired(identityRecord)) {
            window.log.info('Setting approval status...');
            identityRecord
              .save({
                nonblockingApproval,
              })
              .then(() => {
                resolve(false);
              }, reject);
          } else {
            resolve(false);
          }
        });
      });
    },
    isNonBlockingApprovalRequired(identityRecord) {
      return (
        !identityRecord.get('firstUse') &&
        Date.now() - identityRecord.get('timestamp') < TIMESTAMP_THRESHOLD &&
        !identityRecord.get('nonblockingApproval')
      );
    },
    saveIdentityWithAttributes(identifier, attributes) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to put identity key for undefined/null key');
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: number });
        identityRecord.set(attributes);
        if (identityRecord.isValid()) {
          // false if invalid attributes
          identityRecord.save().then(resolve);
        } else {
          reject(identityRecord.validationError);
        }
      });
    },
    setApproval(identifier, nonblockingApproval) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set approval for undefined/null identifier');
      }
      if (typeof nonblockingApproval !== 'boolean') {
        throw new Error('Invalid approval status');
      }
      const number = textsecure.utils.unencodeNumber(identifier)[0];
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: number });
        identityRecord.fetch().then(() => {
          identityRecord
            .save({
              nonblockingApproval,
            })
            .then(
              () => {
                resolve();
              },
              () => {
                // catch
                reject(new Error(`No identity record for ${number}`));
              }
            );
        });
      });
    },
    setVerified(identifier, verifiedStatus, publicKey) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (!validateVerifiedStatus(verifiedStatus)) {
        throw new Error('Invalid verified status');
      }
      if (arguments.length > 2 && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: identifier });
        identityRecord.fetch().then(
          () => {
            if (
              !publicKey ||
              equalArrayBuffers(identityRecord.get('publicKey'), publicKey)
            ) {
              identityRecord.set({ verified: verifiedStatus });

              if (identityRecord.isValid()) {
                identityRecord.save({}).then(() => {
                  resolve();
                }, reject);
              } else {
                reject(identityRecord.validationError);
              }
            } else {
              window.log.info('No identity record for specified publicKey');
              resolve();
            }
          },
          () => {
            // catch
            reject(new Error(`No identity record for ${identifier}`));
          }
        );
      });
    },
    getVerified(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: identifier });
        identityRecord.fetch().then(
          () => {
            const verifiedStatus = identityRecord.get('verified');
            if (validateVerifiedStatus(verifiedStatus)) {
              resolve(verifiedStatus);
            } else {
              resolve(VerifiedStatus.DEFAULT);
            }
          },
          () => {
            // catch
            reject(new Error(`No identity record for ${identifier}`));
          }
        );
      });
    },
    // Resolves to true if a new identity key was saved
    processContactSyncVerificationState(identifier, verifiedStatus, publicKey) {
      if (verifiedStatus === VerifiedStatus.UNVERIFIED) {
        return this.processUnverifiedMessage(
          identifier,
          verifiedStatus,
          publicKey
        );
      }
      return this.processVerifiedMessage(identifier, verifiedStatus, publicKey);
    },
    // This function encapsulates the non-Java behavior, since the mobile apps don't
    //   currently receive contact syncs and therefore will see a verify sync with
    //   UNVERIFIED status
    processUnverifiedMessage(identifier, verifiedStatus, publicKey) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: identifier });
        let isPresent = false;
        let isEqual = false;
        identityRecord
          .fetch()
          .then(() => {
            isPresent = true;
            if (publicKey) {
              isEqual = equalArrayBuffers(
                publicKey,
                identityRecord.get('publicKey')
              );
            }
          })
          .always(() => {
            if (
              isPresent &&
              isEqual &&
              identityRecord.get('verified') !== VerifiedStatus.UNVERIFIED
            ) {
              return textsecure.storage.protocol
                .setVerified(identifier, verifiedStatus, publicKey)
                .then(resolve, reject);
            }

            if (!isPresent || !isEqual) {
              return textsecure.storage.protocol
                .saveIdentityWithAttributes(identifier, {
                  publicKey,
                  verified: verifiedStatus,
                  firstUse: false,
                  timestamp: Date.now(),
                  nonblockingApproval: true,
                })
                .then(() => {
                  if (isPresent && !isEqual) {
                    this.trigger('keychange', identifier);
                    return this.archiveAllSessions(identifier).then(
                      () =>
                        // true signifies that we overwrote a previous key with a new one
                        resolve(true),
                      reject
                    );
                  }

                  return resolve();
                }, reject);
            }

            // The situation which could get us here is:
            //   1. had a previous key
            //   2. new key is the same
            //   3. desired new status is same as what we had before
            return resolve();
          });
      });
    },
    // This matches the Java method as of
    //   https://github.com/signalapp/Signal-Android/blob/d0bb68e1378f689e4d10ac6a46014164992ca4e4/src/org/thoughtcrime/securesms/util/IdentityUtil.java#L188
    processVerifiedMessage(identifier, verifiedStatus, publicKey) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      if (!validateVerifiedStatus(verifiedStatus)) {
        throw new Error('Invalid verified status');
      }
      if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
        throw new Error('Invalid public key');
      }
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: identifier });
        let isPresent = false;
        let isEqual = false;
        identityRecord
          .fetch()
          .then(() => {
            isPresent = true;
            if (publicKey) {
              isEqual = equalArrayBuffers(
                publicKey,
                identityRecord.get('publicKey')
              );
            }
          })
          .always(() => {
            if (!isPresent && verifiedStatus === VerifiedStatus.DEFAULT) {
              window.log.info('No existing record for default status');
              return resolve();
            }

            if (
              isPresent &&
              isEqual &&
              identityRecord.get('verified') !== VerifiedStatus.DEFAULT &&
              verifiedStatus === VerifiedStatus.DEFAULT
            ) {
              return textsecure.storage.protocol
                .setVerified(identifier, verifiedStatus, publicKey)
                .then(resolve, reject);
            }

            if (
              verifiedStatus === VerifiedStatus.VERIFIED &&
              (!isPresent ||
                (isPresent && !isEqual) ||
                (isPresent &&
                  identityRecord.get('verified') !== VerifiedStatus.VERIFIED))
            ) {
              return textsecure.storage.protocol
                .saveIdentityWithAttributes(identifier, {
                  publicKey,
                  verified: verifiedStatus,
                  firstUse: false,
                  timestamp: Date.now(),
                  nonblockingApproval: true,
                })
                .then(() => {
                  if (isPresent && !isEqual) {
                    this.trigger('keychange', identifier);
                    return this.archiveAllSessions(identifier).then(
                      () =>
                        // true signifies that we overwrote a previous key with a new one
                        resolve(true),
                      reject
                    );
                  }

                  return resolve();
                }, reject);
            }

            // We get here if we got a new key and the status is DEFAULT. If the
            //   message is out of date, we don't want to lose whatever more-secure
            //   state we had before.
            return resolve();
          });
      });
    },
    isUntrusted(identifier) {
      if (identifier === null || identifier === undefined) {
        throw new Error('Tried to set verified for undefined/null key');
      }
      return new Promise((resolve, reject) => {
        const identityRecord = new IdentityRecord({ id: identifier });
        identityRecord.fetch().then(
          () => {
            if (
              Date.now() - identityRecord.get('timestamp') <
                TIMESTAMP_THRESHOLD &&
              !identityRecord.get('nonblockingApproval') &&
              !identityRecord.get('firstUse')
            ) {
              resolve(true);
            } else {
              resolve(false);
            }
          },
          () => {
            // catch
            reject(new Error(`No identity record for ${identifier}`));
          }
        );
      });
    },
    async removeIdentityKey(number) {
      const identityRecord = new IdentityRecord({ id: number });
      try {
        await wrapDeferred(identityRecord.fetch());
        await wrapDeferred(identityRecord.destroy());
        return textsecure.storage.protocol.removeAllSessions(number);
      } catch (error) {
        throw new Error('Tried to remove identity for unknown number');
      }
    },

    // Groups
    getGroup(groupId) {
      if (groupId === null || groupId === undefined) {
        throw new Error('Tried to get group for undefined/null id');
      }
      return new Promise(resolve => {
        const group = new Group({ id: groupId });
        group.fetch().always(() => {
          resolve(group.get('data'));
        });
      });
    },
    putGroup(groupId, group) {
      if (groupId === null || groupId === undefined) {
        throw new Error('Tried to put group key for undefined/null id');
      }
      if (group === null || group === undefined) {
        throw new Error('Tried to put undefined/null group object');
      }
      const newGroup = new Group({ id: groupId, data: group });
      return new Promise(resolve => {
        newGroup.save().always(resolve);
      });
    },
    removeGroup(groupId) {
      if (groupId === null || groupId === undefined) {
        throw new Error('Tried to remove group key for undefined/null id');
      }
      return new Promise(resolve => {
        const group = new Group({ id: groupId });
        group.destroy().always(resolve);
      });
    },

    // Not yet processed messages - for resiliency
    getAllUnprocessed() {
      return window.Signal.Data.getAllUnprocessed();
    },
    getUnprocessedById(id) {
      return window.Signal.Data.getUnprocessedById(id, { Unprocessed });
    },
    addUnprocessed(data) {
      // We need to pass forceSave because the data has an id already, which will cause
      //   an update instead of an insert.
      return window.Signal.Data.saveUnprocessed(data, {
        forceSave: true,
        Unprocessed,
      });
    },
    saveUnprocessed(data) {
      return window.Signal.Data.saveUnprocessed(data, { Unprocessed });
    },
    removeUnprocessed(id) {
      return window.Signal.Data.removeUnprocessed(id, { Unprocessed });
    },
    async removeAllData() {
      // First the in-memory caches:
      window.storage.reset(); // items store
      ConversationController.reset(); // conversations store
      await ConversationController.load();

      // Then, the entire database:
      await Whisper.Database.clear();

      await window.Signal.Data.removeAll();
    },
    async removeAllConfiguration() {
      // First the in-memory cache for the items store:
      window.storage.reset();

      // Then anything in the database that isn't a message/conversation/group:
      await Whisper.Database.clearStores([
        'items',
        'identityKeys',
        'sessions',
        'signedPreKeys',
        'preKeys',
        'unprocessed',
      ]);

      await window.Signal.Data.removeAllUnprocessed();
    },
  };
  _.extend(SignalProtocolStore.prototype, Backbone.Events);

  window.SignalProtocolStore = SignalProtocolStore;
  window.SignalProtocolStore.prototype.Direction = Direction;
  window.SignalProtocolStore.prototype.VerifiedStatus = VerifiedStatus;
})();
