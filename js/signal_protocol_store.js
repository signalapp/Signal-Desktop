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
        var result = true;
        var ta1 = new Uint8Array(ab1);
        var ta2 = new Uint8Array(ab2);
        for (var i = 0; i < ab1.byteLength; ++i) {
            if (ta1[i] !== ta2[i]) { result = false; }
        }
        return result;
    }

    var Model = Backbone.Model.extend({ database: Whisper.Database });
    var PreKey = Model.extend({ storeName: 'preKeys' });
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
    var IdentityKey = Model.extend({
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
            return new Promise(function(resolve) {
                item.fetch().then(function() {
                    resolve(item.get('value'));
                });
            });
        },
        getLocalRegistrationId: function() {
            var item = new Item({id: 'registrationId'});
            return new Promise(function(resolve) {
                item.fetch().then(function() {
                    resolve(item.get('value'));
                });
            });
        },

        /* Returns a prekeypair object or undefined */
        loadPreKey: function(keyId) {
            var prekey = new PreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.fetch().then(function() {
                    resolve({
                        pubKey: prekey.attributes.publicKey,
                        privKey: prekey.attributes.privateKey
                    });
                }).fail(resolve);
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
                prekey.destroy().then(function() {
                    resolve();
                });
            });
        },

        /* Returns a signed keypair object or undefined */
        loadSignedPreKey: function(keyId) {
            var prekey = new SignedPreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.fetch().then(function() {
                    resolve({
                        pubKey     : prekey.get('publicKey'),
                        privKey    : prekey.get('privateKey'),
                        created_at : prekey.get('created_at'),
                        keyId      : prekey.get('id')
                    });
                }).fail(function() {
                    console.log("Failed to load signed prekey:", keyId);
                    resolve();
                });
            });
        },
        loadSignedPreKeys: function() {
            if (arguments.length > 0) {
              return Promise.reject(new Error("loadSignedPreKeys takes no arguments"));
            }
            var signedPreKeys = new SignedPreKeyCollection();
            return new Promise(function(resolve) {
                signedPreKeys.fetch().then(function() {
                    resolve(signedPreKeys.map(function(prekey) {
                        return {
                            pubKey     : prekey.get('publicKey'),
                            privKey    : prekey.get('privateKey'),
                            created_at : prekey.get('created_at'),
                            keyId      : prekey.get('id')
                        };
                    }));
                });
            });
        },
        storeSignedPreKey: function(keyId, keyPair) {
            var prekey = new SignedPreKey({
                id         : keyId,
                publicKey  : keyPair.pubKey,
                privateKey : keyPair.privKey,
                created_at : Date.now()
            });
            return new Promise(function(resolve) {
                prekey.save().always(function() {
                    resolve();
                });
            });
        },
        removeSignedPreKey: function(keyId) {
            var prekey = new SignedPreKey({id: keyId});
            return new Promise(function(resolve) {
                prekey.destroy().then(function() {
                    resolve();
                });
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
            return new Promise(function(resolve) {
                var sessions = new SessionCollection();
                sessions.fetchSessionsForNumber(number).always(function() {
                    var promises = [];
                    while (sessions.length > 0) {
                        promises.push(new Promise(function(res) {
                            sessions.pop().destroy().then(res);
                        }));
                    }
                    Promise.all(promises).then(resolve);
                });
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
            var identityKey = new IdentityKey({id: number});
            return new Promise(function(resolve) {
                identityKey.fetch().always(resolve);
            }).then(function() {
                var existing = identityKey.get('publicKey');

                if (isOurNumber) {
                    return equalArrayBuffers(existing, publicKey);
                }

                switch(direction) {
                    case Direction.SENDING:   return this.isTrustedForSending(publicKey, identityKey);
                    case Direction.RECEIVING: return true;
                    default:        throw new Error("Unknown direction: " + direction);
                }
            }.bind(this));
        },
        isTrustedForSending: function(publicKey, identityKey) {
            var existing = identityKey.get('publicKey');

            if (!existing) {
                console.log("isTrustedForSending: Nothing here, returning true...");
                return true;
            }
            if (!equalArrayBuffers(existing, publicKey)) {
                console.log("isTrustedForSending: Identity keys don't match...");
                return false;
            }
            if (identityKey.get('verified') === VerifiedStatus.UNVERIFIED) {
               console.log("Needs unverified approval!");
               return false;
            }
            if (this.isNonBlockingApprovalRequired(identityKey)) {
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
                var identityKey = new IdentityKey({id: number});
                identityKey.fetch().always(function() {
                    resolve(identityKey.get('publicKey'));
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
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve, reject) {
                var identityKey = new IdentityKey({id: number});
                identityKey.fetch().always(function() {
                    var oldpublicKey = identityKey.get('publicKey');
                    if (!oldpublicKey) {
                        // Lookup failed, or the current key was removed, so save this one.
                        console.log("Saving new identity...");
                        identityKey.save({
                            publicKey           : publicKey,
                            firstUse            : true,
                            timestamp           : Date.now(),
                            verified            : VerifiedStatus.DEFAULT,
                            nonblockingApproval : nonblockingApproval,
                        }).then(function() {
                            resolve(false);
                        });
                    } else if (!equalArrayBuffers(oldpublicKey, publicKey)) {
                        console.log("Replacing existing identity...");
                        var verifiedStatus;
                        if (identityKey.get('verified') === VerifiedStatus.VERIFIED) {
                            verifiedStatus = VerifiedStatus.UNVERIFIED;
                        } else {
                            verifiedStatus = VerifiedStatus.DEFAULT;
                        }
                        identityKey.save({
                            publicKey           : publicKey,
                            firstUse            : false,
                            timestamp           : Date.now(),
                            verified            : verifiedStatus,
                            nonblockingApproval : nonblockingApproval,
                        }).then(function() {
                            this.trigger('keychange', identifier);
                            resolve(true);
                        }.bind(this));
                    } else if (this.isNonBlockingApprovalRequired(identityKey)) {
                        console.log("Setting approval status...");
                        identityKey.save({
                            nonblockingApproval : nonblockingApproval,
                        }).then(function() {
                            resolve(false);
                        });
                    } else {
                        resolve(false);
                    }
                }.bind(this));
            }.bind(this));
        },
        isNonBlockingApprovalRequired: function(identityKey) {
          return (!identityKey.get('firstUse')
                  && Date.now() - identityKey.get('timestamp') < TIMESTAMP_THRESHOLD
                  && !identityKey.get('nonblockingApproval'));
        },
        saveIdentityWithAttributes: function(identifier, attributes) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to put identity key for undefined/null key");
            }
            var number = textsecure.utils.unencodeNumber(identifier)[0];
            return new Promise(function(resolve, reject) {
                var identityKey = new IdentityKey({id: number});
                identityKey.set(attributes);
                if (identityKey.isValid()) { // false if invalid attributes
                    identityKey.save().then(resolve);
                } else {
                    reject(identityKey.validationError);
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
                var identityKey = new IdentityKey({id: number});
                identityKey.fetch().then(function() {
                    identityKey.save({
                        nonblockingApproval: nonblockingApproval
                    }).then(function() {
                        resolve();
                    }, function() { // catch
                        reject(new Error("No identity record for " + number));
                    });
                });
            });
        },
        setVerified: function(identifier, verifiedStatus) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            if (!validateVerifiedStatus(verifiedStatus)) {
                throw new Error("Invalid verified status");
            }
            return new Promise(function(resolve, reject) {
                var identityKey = new IdentityKey({id: identifier});
                identityKey.fetch().always(function() {
                    identityKey.save({
                        verified: verifiedStatus
                    }).then(function() {
                        resolve();
                    }, function() { // catch
                        reject(new Error("No identity record for " + identifier));
                    });
                });
            });
        },
        getVerified: function(identifier) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            return new Promise(function(resolve, reject) {
                var identityKey = new IdentityKey({id: identifier});
                identityKey.fetch().then(function() {
                    var verifiedStatus = identityKey.get('verified');
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
        isUntrusted: function(identifier) {
            if (identifier === null || identifier === undefined) {
                throw new Error("Tried to set verified for undefined/null key");
            }
            return new Promise(function(resolve, reject) {
                var identityKey = new IdentityKey({id: identifier});
                identityKey.fetch().then(function() {
                    if (Date.now() - identityKey.get('timestamp') < TIMESTAMP_THRESHOLD
                        && !identityKey.get('nonblockingApproval')) {
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
                var identityKey = new IdentityKey({id: number});
                identityKey.fetch().then(function() {
                    identityKey.save({publicKey: undefined});
                }).fail(function() {
                    reject(new Error("Tried to remove identity for unknown number"));
                });
                resolve(textsecure.storage.protocol.removeAllSessions(number));
            });
        },
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

    };
    _.extend(SignalProtocolStore.prototype, Backbone.Events);

    window.SignalProtocolStore = SignalProtocolStore;
    window.SignalProtocolStore.prototype.Direction = Direction;
    window.SignalProtocolStore.prototype.VerifiedStatus = VerifiedStatus;
})();
