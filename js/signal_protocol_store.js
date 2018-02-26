/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    var TIMESTAMP_THRESHOLD = 5 * 1000; // 5 seconds
    var Direction = {
      SENDING: 1,
      RECEIVING: 2,
    };

    var VerifiedStatus = {
      DEFAULT: 0,
      VERIFIED: 1,
      UNVERIFIED: 2,
    };

    function validateVerifiedStatus(status) {
      if ( status === VerifiedStatus.DEFAULT
        || status === VerifiedStatus.VERIFIED
        || status === VerifiedStatus.UNVERIFIED) {
        return true;
      }
      return false;
    }

    var StaticByteBufferProto = new dcodeIO.ByteBuffer().__proto__;
    var StaticArrayBufferProto = new ArrayBuffer().__proto__;
    var StaticUint8ArrayProto = new Uint8Array().__proto__;

    function isStringable(thing) {
        return (thing === Object(thing) &&
                    (thing.__proto__ == StaticArrayBufferProto ||
                    thing.__proto__ == StaticUint8ArrayProto ||
                    thing.__proto__ == StaticByteBufferProto));
    }
    function convertToArrayBuffer(thing) {
        if (thing === undefined) {
            return undefined;
        }
        if (thing === Object(thing)) {
            if (thing.__proto__ == StaticArrayBufferProto) {
                return thing;
            }
            //TODO: Several more cases here...
        }

        if (thing instanceof Array) {
            // Assuming Uint16Array from curve25519
            var res = new ArrayBuffer(thing.length * 2);
            var uint = new Uint16Array(res);
            for (var i = 0; i < thing.length; i++) {
                uint[i] = thing[i];
            }
            return res;
        }

        var str;
        if (isStringable(thing)) {
            str = stringObject(thing);
        } else if (typeof thing == "string") {
            str = thing;
        } else {
            throw new Error("Tried to convert a non-stringable thing of type " + typeof thing + " to an array buffer");
        }
        var res = new ArrayBuffer(str.length);
        var uint = new Uint8Array(res);
        for (var i = 0; i < str.length; i++) {
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
        var result = 0;
        var ta1 = new Uint8Array(ab1);
        var ta2 = new Uint8Array(ab2);
        for (var i = 0; i < ab1.byteLength; ++i) {
            result = result | ta1[i] ^ ta2[i];
        }
        return result === 0;
    }

    var Model = Backbone.Model.extend({ database: Whisper.Database });
    var PreKey = Model.extend({ storeName: 'preKeys' });
    var PreKeyCollection = Backbone.Collection.extend({
        storeName: 'preKeys',
        database: Whisper.Database,
        model: PreKey
    });
    var SignedPreKey = Model.extend({ storeName: 'signedPreKeys' });
    var SignedPreKeyCollection = Backbone.Collection.extend({
        storeName: 'signedPreKeys',
        database: Whisper.Database,
        model: SignedPreKey
    });
    var Session = Model.extend({ storeName: 'sessions' });
    var SessionCollection = Backbone.Collection.extend({
        storeName: 'sessions',
        database: Whisper.Database,
        model: Session,
        fetchSessionsForNumber: function(number) {
            return this.fetch({range: [number + '.1', number + '.' + ':']});
        }
    });
    var Unprocessed = Model.extend({ storeName : 'unprocessed' });
    var UnprocessedCollection = Backbone.Collection.extend({
        storeName  : 'unprocessed',
        database   : Whisper.Database,
        model      : Unprocessed,
        comparator : 'timestamp'
    });
    var IdentityRecord = Model.extend({
      storeName: 'identityKeys',
      validAttributes: [
          'id',
          'publicKey',
          'firstUse',
          'timestamp',
          'verified',
          'nonblockingApproval'
      ],
      validate: function(attrs, options) {
          var attributeNames = _.keys(attrs);
          var validAttributes = this.validAttributes;
          var allValid = _.all(attributeNames, function(attributeName) {
              return _.contains(validAttributes, attributeName);
          });
          if (!allValid) {
              return new Error("Invalid identity key attribute names");
          }
          var allPresent = _.all(validAttributes, function(attributeName) {
              return _.contains(attributeNames, attributeName);
          });
          if (!allPresent) {
              return new Error("Missing identity key attributes");
          }

          if (typeof attrs.id !== 'string') {
              return new Error("Invalid identity key id");
          }
          if (!(attrs.publicKey instanceof ArrayBuffer)) {
              return new Error("Invalid identity key publicKey");
          }
          if (typeof attrs.firstUse !== 'boolean') {
              return new Error("Invalid identity key firstUse");
          }
          if (typeof attrs.timestamp !== 'number' || !(attrs.timestamp >= 0)) {
              return new Error("Invalid identity key timestamp");
          }
          if (!validateVerifiedStatus(attrs.verified)) {
              return new Error("Invalid identity key verified");
          }
          if (typeof attrs.nonblockingApproval !== 'boolean') {
              return new Error("Invalid identity key nonblockingApproval");
          }
      }
    });
    var Group = Model.extend({ storeName: 'groups' });
    var Item = Model.extend({ storeName: 'items' });

    function SignalProtocolStore() {}

    SignalProtocolStore.prototype = {
        constructor: SignalProtocolStore,
        getIdentityKeyPair: function() {
            var item = new Item({id: 'identityKey'});
            return new Promise(function(resolve, reject) {
                item.fetch().then(function() {
                    resolve(item.get('value'));
                }, reject);
            });
        },
        getLocalRegistrationId: function() {
            var item = new Item({id: 'registrationId'});
            return new Promise(function(resolve, reject) {
                item.fetch().then(function() {
                    resolve(item.get('value'));
                }, reject);
            });
        },

        /* Returns a prekeypair object or undefined */
        loadPreKey: function(keyId) {
            var prekey = new PreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.fetch().then(function() {
                    console.log('Successfully fetched prekey:', keyId);
                    resolve({
                        pubKey: prekey.get('publicKey'),
                        privKey: prekey.get('privateKey'),
                    });
                }, function() {
                    console.log('Failed to fetch prekey:', keyId);
                    resolve();
                });
            });
        },
        storePreKey: function(keyId, keyPair) {
            var prekey = new PreKey({
                id         : keyId,
                publicKey  : keyPair.pubKey,
                privateKey : keyPair.privKey
            });
            return new Promise(function(resolve) {
                prekey.save().always(function() {
                    resolve();
                });
            });
        },
        removePreKey: function(keyId) {
            var prekey = new PreKey({id: keyId});

            this.trigger('removePreKey');

            return new Promise(function(resolve) {
                var deferred = prekey.destroy();
                if (!deferred) {
                    return resolve();
                }

                return deferred.then(resolve, function(error) {
                    console.log(
                        'removePreKey error:',
                        error && error.stack ? error.stack : error
                    );
                    resolve();
                });
            });
        },
        clearPreKeyStore: function() {
            return new Promise(function(resolve) {
                var preKeys = new PreKeyCollection();
                preKeys.sync('delete', preKeys, {}).always(resolve);
            });
        },

        /* Returns a signed keypair object or undefined */
        loadSignedPreKey: function(keyId) {
            var prekey = new SignedPreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.fetch().then(function() {
                    console.log('Successfully fetched signed prekey:', prekey.get('id'));
                    resolve({
                        pubKey     : prekey.get('publicKey'),
                        privKey    : prekey.get('privateKey'),
                        created_at : prekey.get('created_at'),
                        keyId      : prekey.get('id'),
                        confirmed  : prekey.get('confirmed'),
                    });
                }).fail(function() {
                    console.log('Failed to fetch signed prekey:', keyId);
                    resolve();
                });
            });
        },
        loadSignedPreKeys: function() {
            if (arguments.length > 0) {
              return Promise.reject(new Error('loadSignedPreKeys takes no arguments'));
            }
            var signedPreKeys = new SignedPreKeyCollection();
            return new Promise(function(resolve) {
                signedPreKeys.fetch().then(function() {
                    resolve(signedPreKeys.map(function(prekey) {
                        return {
                            pubKey     : prekey.get('publicKey'),
                            privKey    : prekey.get('privateKey'),
                            created_at : prekey.get('created_at'),
                            keyId      : prekey.get('id'),
                            confirmed  : prekey.get('confirmed'),
                        };
                    }));
                });
            });
        },
        storeSignedPreKey: function(keyId, keyPair, confirmed) {
            var prekey = new SignedPreKey({
                id         : keyId,
                publicKey  : keyPair.pubKey,
                privateKey : keyPair.privKey,
                created_at : Date.now(),
                confirmed  : Boolean(confirmed),
            });
            return new Promise(function(resolve) {
                prekey.save().always(function() {
                    resolve();
                });
            });
        },
        removeSignedPreKey: function(keyId) {
            var prekey = new SignedPreKey({id: keyId});
            return new Promise(function(resolve, reject) {
                var deferred = prekey.destroy();
                if (!deferred) {
                    return resolve();
                }

                deferred.then(resolve, reject);
            });
        },
        clearSignedPreKeysStore: function() {
            return new Promise(function(resolve) {
                var signedPreKeys = new SignedPreKeyCollection();
                signedPreKeys.sync('delete', signedPreKeys, {}).always(resolve);
            });
        },

        loadSession: function(encodedNumber) {
            if (encodedNumber === null || encodedNumber === undefined) {
                throw new Error("Tried to get session for undefined/null number");
            }
            return new Promise(function(resolve) {
                var session = new Session({id: encodedNumber});
                session.fetch().always(function() {
                    resolve(session.get('record'));
                });

            });
        },
        storeSession: function(encodedNumber, record) {
            if (encodedNumber === null || encodedNumber === undefined) {
                throw new Error("Tried to put session for undefined/null number");
            }
            return new Promise(function(resolve) {
                var number = textsecure.utils.unencodeNumber(encodedNumber)[0];
                var deviceId = parseInt(textsecure.utils.unencodeNumber(encodedNumber)[1]);

                var session = new Session({id: encodedNumber});
                session.fetch().always(function() {
                    session.save({
                        record: record,
                        deviceId: deviceId,
                        number: number
                    }).fail(function(e) {
                        console.log('Failed to save session', encodedNumber, e);
                    }).always(function() {
                        resolve();
                    });
                });
            });
        },
        getDeviceIds: function(number) {
            if (number === null || number === undefined) {
                throw new Error("Tried to get device ids for undefined/null number");
            }
            return new Promise(function(resolve) {
                var sessions = new SessionCollection();
                sessions.fetchSessionsForNumber(number).always(function() {
                    resolve(sessions.pluck('deviceId'));
                });
            });
        },
        removeSession: function(encodedNumber) {
            console.log('deleting session for ', encodedNumber);
            return new Promise(function(resolve) {
                var session = new Session({id: encodedNumber});
                session.fetch().then(function() {
                    session.destroy().then(resolve);
                }).fail(resolve);
            });
        },
        removeAllSessions: function(number) {
            if (number === null || number === undefined) {
                throw new Error("Tried to remove sessions for undefined/null number");
            }
            return new Promise(function(resolve, reject) {
                var sessions = new SessionCollection();
                sessions.fetchSessionsForNumber(number).always(function() {
                    var promises = [];
                    while (sessions.length > 0) {
                        promises.push(new Promise(function(res, rej) {
                            sessions.pop().destroy().then(res, rej);
                        }));
                    }
                    Promise.all(promises).then(resolve, reject);
                });
            });
        },
        archiveSiblingSessions: function(identifier) {
            var address = libsignal.SignalProtocolAddress.fromString(identifier);
            return this.getDeviceIds(address.getName()).then(function(deviceIds) {
                var deviceIds = _.without(deviceIds, address.getDeviceId());
                return Promise.all(deviceIds.map(function(deviceId) {
                    var sibling = new libsignal.SignalProtocolAddress(address.getName(), deviceId);
                    console.log('closing session for', sibling.toString());
                    var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, sibling);
                    return sessionCipher.closeOpenSessionForDevice();
                }));
            });
        },
        archiveAllSessions: function(number) {
            return this.getDeviceIds(number).then(function(deviceIds) {
                return Promise.all(deviceIds.map(function(deviceId) {
                    var address = new libsignal.SignalProtocolAddress(number, deviceId);
                    console.log('closing session for', address.toString());
                    var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address);
                    return sessionCipher.closeOpenSessionForDevice();
                }));
            });
        },
        clearSessionStore: function() {
            return new Promise(function(resolve) {
                var sessions = new SessionCollection();
                sessions.sync('delete', sessions, {}).always(resolve);
            });
        },
        isTrustedIdentity: function(identifier, publicKey, direction) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to get identity key for undefined/null key");
            }
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            var isOurNumber = number === textsecure.storage.user.getNumber();
            var identityRecord = new IdentityRecord({id: number});
            return new Promise(function(resolve) {
                identityRecord.fetch().always(resolve);
            }).then(function() {
                var existing = identityRecord.get('publicKey');

                if (isOurNumber) {
                    return equalArrayBuffers(existing, publicKey);
                }

                switch(direction) {
                    case Direction.SENDING:   return this.isTrustedForSending(publicKey, identityRecord);
                    case Direction.RECEIVING: return true;
                    default:        throw new Error("Unknown direction: " + direction);
                }
            }.bind(this));
        },
        isTrustedForSending: function(publicKey, identityRecord) {
            var existing = identityRecord.get('publicKey');

            if (!existing) {
                console.log("isTrustedForSending: Nothing here, returning true...");
                return true;
            }
            if (!equalArrayBuffers(existing, publicKey)) {
                console.log("isTrustedForSending: Identity keys don't match...");
                return false;
            }
            if (identityRecord.get('verified') === VerifiedStatus.UNVERIFIED) {
               console.log("Needs unverified approval!");
               return false;
            }
            if (this.isNonBlockingApprovalRequired(identityRecord)) {
                console.log("isTrustedForSending: Needs non-blocking approval!");
                return false;
            }

            return true;
        },
        loadIdentityKey: function(identifier) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to get identity key for undefined/null key");
            }
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve) {
                var identityRecord = new IdentityRecord({id: number});
                identityRecord.fetch().always(function() {
                    resolve(identityRecord.get('publicKey'));
                });
            });
        },
        saveIdentity: function(identifier, publicKey, nonblockingApproval) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to put identity key for undefined/null key");
            }
            if (!(publicKey instanceof ArrayBuffer)) {
                publicKey = convertToArrayBuffer(publicKey);
            }
            if (typeof nonblockingApproval !== 'boolean') {
              nonblockingApproval = false;
            }
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: number});
                identityRecord.fetch().always(function() {
                    var oldpublicKey = identityRecord.get('publicKey');
                    if (!oldpublicKey) {
                        // Lookup failed, or the current key was removed, so save this one.
                        console.log("Saving new identity...");
                        identityRecord.save({
                            publicKey           : publicKey,
                            firstUse            : true,
                            timestamp           : Date.now(),
                            verified            : VerifiedStatus.DEFAULT,
                            nonblockingApproval : nonblockingApproval,
                        }).then(function() {
                            resolve(false);
                        }, reject);
                    } else if (!equalArrayBuffers(oldpublicKey, publicKey)) {
                        console.log("Replacing existing identity...");
                        var previousStatus = identityRecord.get('verified');
                        var verifiedStatus;
                        if (previousStatus === VerifiedStatus.VERIFIED
                            || previousStatus === VerifiedStatus.UNVERIFIED) {
                            verifiedStatus = VerifiedStatus.UNVERIFIED;
                        } else {
                            verifiedStatus = VerifiedStatus.DEFAULT;
                        }
                        identityRecord.save({
                            publicKey           : publicKey,
                            firstUse            : false,
                            timestamp           : Date.now(),
                            verified            : verifiedStatus,
                            nonblockingApproval : nonblockingApproval,
                        }).then(function() {
                            this.trigger('keychange', number);
                            this.archiveSiblingSessions(identifier).then(function() {
                                resolve(true);
                            }, reject);
                        }.bind(this), reject);
                    } else if (this.isNonBlockingApprovalRequired(identityRecord)) {
                        console.log("Setting approval status...");
                        identityRecord.save({
                            nonblockingApproval : nonblockingApproval,
                        }).then(function() {
                            resolve(false);
                        }, reject);
                    } else {
                        resolve(false);
                    }
                }.bind(this));
            }.bind(this));
        },
        isNonBlockingApprovalRequired: function(identityRecord) {
          return (!identityRecord.get('firstUse')
                  && Date.now() - identityRecord.get('timestamp') < TIMESTAMP_THRESHOLD
                  && !identityRecord.get('nonblockingApproval'));
        },
        saveIdentityWithAttributes: function(identifier, attributes) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to put identity key for undefined/null key");
            }
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: number});
                identityRecord.set(attributes);
                if (identityRecord.isValid()) { // false if invalid attributes
                    identityRecord.save().then(resolve);
                } else {
                    reject(identityRecord.validationError);
                }
            });
        },
        setApproval: function(identifier, nonblockingApproval) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set approval for undefined/null identifier");
            }
            if (typeof nonblockingApproval !== 'boolean') {
                throw new Error("Invalid approval status");
            }
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: number});
                identityRecord.fetch().then(function() {
                    identityRecord.save({
                        nonblockingApproval: nonblockingApproval
                    }).then(function() {
                        resolve();
                    }, function() { // catch
                        reject(new Error("No identity record for " + number));
                    });
                });
            });
        },
        setVerified: function(identifier, verifiedStatus, publicKey) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            if (!validateVerifiedStatus(verifiedStatus)) {
                throw new Error("Invalid verified status");
            }
            if (arguments.length > 2 && !(publicKey instanceof ArrayBuffer)) {
                throw new Error("Invalid public key");
            }
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: identifier});
                identityRecord.fetch().then(function() {
                    if (!publicKey || equalArrayBuffers(identityRecord.get('publicKey'), publicKey)) {
                        identityRecord.set({ verified: verifiedStatus });

                        if (identityRecord.isValid()) {
                            identityRecord.save({
                            }).then(function() {
                                resolve();
                            }, reject);
                        } else {
                            reject(identityRecord.validationError);
                        }
                    } else {
                        console.log("No identity record for specified publicKey");
                        resolve();
                    }
                }, function() { // catch
                    reject(new Error("No identity record for " + identifier));
                });
            });
        },
        getVerified: function(identifier) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: identifier});
                identityRecord.fetch().then(function() {
                    var verifiedStatus = identityRecord.get('verified');
                    if (validateVerifiedStatus(verifiedStatus)) {
                        resolve(verifiedStatus);
                    }
                    else {
                        resolve(VerifiedStatus.DEFAULT);
                    }
                }, function() { // catch
                    reject(new Error("No identity record for " + identifier));
                });
            });
        },
        // Resolves to true if a new identity key was saved
        processContactSyncVerificationState: function(identifier, verifiedStatus, publicKey) {
            if (verifiedStatus === VerifiedStatus.UNVERIFIED) {
                return this.processUnverifiedMessage(identifier, verifiedStatus, publicKey);
            } else {
                return this.processVerifiedMessage(identifier, verifiedStatus, publicKey);
            }
        },
        // This function encapsulates the non-Java behavior, since the mobile apps don't
        //   currently receive contact syncs and therefore will see a verify sync with
        //   UNVERIFIED status
        processUnverifiedMessage: function(identifier, verifiedStatus, publicKey) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
                throw new Error("Invalid public key");
            }
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: identifier});
                var isPresent = false;
                var isEqual = false;
                identityRecord.fetch().then(function() {
                    isPresent = true;
                    if (publicKey) {
                      isEqual = equalArrayBuffers(publicKey, identityRecord.get('publicKey'));
                    }
                }).always(function() {
                    if (isPresent
                        && isEqual
                        && identityRecord.get('verified') !== VerifiedStatus.UNVERIFIED) {

                        return textsecure.storage.protocol.setVerified(
                          identifier, verifiedStatus, publicKey
                        ).then(resolve, reject);
                    }

                    if (!isPresent || !isEqual) {
                        return textsecure.storage.protocol.saveIdentityWithAttributes(identifier, {
                            publicKey           : publicKey,
                            verified            : verifiedStatus,
                            firstUse            : false,
                            timestamp           : Date.now(),
                            nonblockingApproval : true
                        }).then(function() {
                            if (isPresent && !isEqual) {
                                this.trigger('keychange', identifier);
                                return this.archiveAllSessions(identifier).then(function() {
                                    // true signifies that we overwrote a previous key with a new one
                                    return resolve(true);
                                }, reject);
                            }

                            return resolve();
                        }.bind(this), reject);
                    }

                    // The situation which could get us here is:
                    //   1. had a previous key
                    //   2. new key is the same
                    //   3. desired new status is same as what we had before
                    return resolve();
                }.bind(this));
            }.bind(this));
        },
        // This matches the Java method as of
        //   https://github.com/signalapp/Signal-Android/blob/d0bb68e1378f689e4d10ac6a46014164992ca4e4/src/org/thoughtcrime/securesms/util/IdentityUtil.java#L188
        processVerifiedMessage: function(identifier, verifiedStatus, publicKey) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            if (!validateVerifiedStatus(verifiedStatus)) {
                throw new Error("Invalid verified status");
            }
            if (publicKey !== undefined && !(publicKey instanceof ArrayBuffer)) {
                throw new Error("Invalid public key");
            }
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: identifier});
                var isPresent = false;
                var isEqual = false;
                identityRecord.fetch().then(function() {
                    isPresent = true;
                    if (publicKey) {
                      isEqual = equalArrayBuffers(publicKey, identityRecord.get('publicKey'));
                    }
                }).always(function() {
                    if (!isPresent && verifiedStatus === VerifiedStatus.DEFAULT) {
                        console.log('No existing record for default status');
                        return resolve();
                    }

                    if (isPresent && isEqual
                        && identityRecord.get('verified') !== VerifiedStatus.DEFAULT
                        && verifiedStatus === VerifiedStatus.DEFAULT) {

                        return textsecure.storage.protocol.setVerified(
                          identifier, verifiedStatus, publicKey
                        ).then(resolve, reject);
                    }

                    if (verifiedStatus === VerifiedStatus.VERIFIED
                        && (!isPresent
                            || (isPresent && !isEqual)
                            || (isPresent && identityRecord.get('verified') !== VerifiedStatus.VERIFIED))) {

                        return textsecure.storage.protocol.saveIdentityWithAttributes(identifier, {
                            publicKey           : publicKey,
                            verified            : verifiedStatus,
                            firstUse            : false,
                            timestamp           : Date.now(),
                            nonblockingApproval : true
                        }).then(function() {
                            if (isPresent && !isEqual) {
                                this.trigger('keychange', identifier);
                                return this.archiveAllSessions(identifier).then(function() {
                                    // true signifies that we overwrote a previous key with a new one
                                    return resolve(true);
                                }, reject);
                            }

                            return resolve();
                        }.bind(this), reject);
                    }

                    // We get here if we got a new key and the status is DEFAULT. If the
                    //   message is out of date, we don't want to lose whatever more-secure
                    //   state we had before.
                    return resolve();
                }.bind(this));
            }.bind(this));
        },
        isUntrusted: function(identifier) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: identifier});
                identityRecord.fetch().then(function() {
                    if (Date.now() - identityRecord.get('timestamp') < TIMESTAMP_THRESHOLD
                        && !identityRecord.get('nonblockingApproval')
                        && !identityRecord.get('firstUse')) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, function() { // catch
                    reject(new Error("No identity record for " + identifier));
                });
            });
        },
        removeIdentityKey: function(number) {
            return new Promise(function(resolve, reject) {
                var identityRecord = new IdentityRecord({id: number});
                identityRecord.fetch().then(function() {
                    identityRecord.destroy();
                }).fail(function() {
                    reject(new Error("Tried to remove identity for unknown number"));
                });
                resolve(textsecure.storage.protocol.removeAllSessions(number));
            });
        },

        // Groups
        getGroup: function(groupId) {
            if (groupId === null || groupId === undefined) {
                throw new Error("Tried to get group for undefined/null id");
            }
            return new Promise(function(resolve) {
                var group = new Group({id: groupId});
                group.fetch().always(function() {
                    resolve(group.get('data'));
                });
            });
        },
        putGroup: function(groupId, group) {
            if (groupId === null || groupId === undefined) {
                throw new Error("Tried to put group key for undefined/null id");
            }
            if (group === null || group === undefined) {
                throw new Error("Tried to put undefined/null group object");
            }
            var group = new Group({id: groupId, data: group});
            return new Promise(function(resolve) {
                group.save().always(resolve);
            });
        },
        removeGroup: function(groupId) {
            if (groupId === null || groupId === undefined) {
                throw new Error("Tried to remove group key for undefined/null id");
            }
            return new Promise(function(resolve) {
                var group = new Group({id: groupId});
                group.destroy().always(resolve);
            });
        },

        // Not yet processed messages - for resiliency
        getAllUnprocessed: function() {
            var collection;
            return new Promise(function(resolve, reject) {
                collection = new UnprocessedCollection();
                return collection.fetch().then(resolve, reject);
            }).then(function() {
                // Return a plain array of plain objects
                return collection.map('attributes');
            });
        },
        addUnprocessed: function(data) {
            return new Promise(function(resolve, reject) {
                var unprocessed = new Unprocessed(data);
                return unprocessed.save().then(resolve, reject);
            });
        },
        updateUnprocessed: function(id, updates) {
            return new Promise(function(resolve, reject) {
                var unprocessed = new Unprocessed({
                    id: id
                });
                return unprocessed.fetch().then(function() {
                    return unprocessed.save(updates).then(resolve, reject);
                }, reject);
            }.bind(this));
        },
        removeUnprocessed: function(id) {
            return new Promise(function(resolve, reject) {
                var unprocessed = new Unprocessed({
                    id: id
                });
                return unprocessed.destroy().then(resolve, reject);
            }.bind(this));
        },
        removeAllData: function() {
            // First the in-memory caches:
            window.storage.reset(); // items store
            ConversationController.reset(); // conversations store

            // Then, the entire database:
            return window.Whisper.Backup.clearDatabase();
        },
        removeAllConfiguration: function() {
            // First the in-memory cache for the items store:
            window.storage.reset();

            // Then anything in the database that isn't a message/conversation/group:
            return window.Whisper.Backup.clearStores([
                'items',
                'identityKeys',
                'sessions',
                'signedPreKeys',
                'preKeys',
                'unprocessed',
            ]);
        }
    };
    _.extend(SignalProtocolStore.prototype, Backbone.Events);

    window.SignalProtocolStore = SignalProtocolStore;
    window.SignalProtocolStore.prototype.Direction = Direction;
    window.SignalProtocolStore.prototype.VerifiedStatus = VerifiedStatus;
})();
