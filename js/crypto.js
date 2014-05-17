/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

window.textsecure = window.textsecure || {};

window.textsecure.crypto = new function() {
	var self = {};
	// functions exposed for replacement and direct calling in test code
	var testing_only = {};

	/******************************
	 *** Random constants/utils ***
	 ******************************/
	// We consider messages lost after a week and might throw away keys at that point
	var MESSAGE_LOST_THRESHOLD_MS = 1000*60*60*24*7;

	var getRandomBytes = function(size) {
		//TODO: Better random (https://www.grc.com/r&d/js.htm?)
		try {
			var buffer = new ArrayBuffer(size);
			var array = new Uint8Array(buffer);
			window.crypto.getRandomValues(array);
			return buffer;
		} catch (err) {
			//TODO: ummm...wat?
			throw err;
		}
	}
	self.getRandomBytes = getRandomBytes;

	function intToArrayBuffer(nInt) {
		var res = new ArrayBuffer(16);
		var thing = new Uint8Array(res);
		thing[0] = (nInt >> 24) & 0xff;
		thing[1] = (nInt >> 16) & 0xff;
		thing[2] = (nInt >> 8 ) & 0xff;
		thing[3] = (nInt >> 0 ) & 0xff;
		return res;
	}

	function HmacSHA256(key, input) {
		return window.crypto.subtle.sign({name: "HMAC", hash: "SHA-256"}, key, input);
	}

	testing_only.privToPub = function(privKey, isIdentity) {
		if (privKey.byteLength != 32)
			throw new Error("Invalid private key");

		var prependVersion = function(pubKey) {
			var origPub = new Uint8Array(pubKey);
			var pub = new ArrayBuffer(33);
			var pubWithPrefix = new Uint8Array(pub);
			pubWithPrefix.set(origPub, 1);
			pubWithPrefix[0] = 5;
			return pub;
		}

		if (textsecure.nacl.USE_NACL) {
			return postNaclMessage({command: "bytesToPriv", priv: privKey}).then(function(message) {
				var priv = message.res;
				if (!isIdentity)
					new Uint8Array(priv)[0] |= 0x01;
				return postNaclMessage({command: "privToPub", priv: priv}).then(function(message) {
					return { pubKey: prependVersion(message.res), privKey: priv };
				});
			});
		} else {
			privKey = privKey.slice(0);
			var priv = new Uint16Array(privKey);
			priv[0] &= 0xFFF8;
			priv[15] = (priv[15] & 0x7FFF) | 0x4000;

			if (!isIdentity)
				priv[0] |= 0x0001;

			//TODO: fscking type conversion
			return new Promise.resolve({ pubKey: prependVersion(toArrayBuffer(curve25519(priv))), privKey: privKey});
		}
	
	}
	var privToPub = function(privKey, isIdentity) { return testing_only.privToPub(privKey, isIdentity); }

	testing_only.createNewKeyPair = function(isIdentity) {
		return privToPub(getRandomBytes(32), isIdentity);
	}
	var createNewKeyPair = function(isIdentity) { return testing_only.createNewKeyPair(isIdentity); }

	/***************************
	 *** Key/session storage ***
	 ***************************/
	var crypto_storage = {};

	crypto_storage.getNewPubKeySTORINGPrivKey = function(keyName, isIdentity) {
		return createNewKeyPair(isIdentity).then(function(keyPair) {
			storage.putEncrypted("25519Key" + keyName, keyPair);
			return keyPair.pubKey;
		});
	}

	crypto_storage.getStoredPubKey = function(keyName) {
		return toArrayBuffer(storage.getEncrypted("25519Key" + keyName, { pubKey: undefined }).pubKey);
	}

	crypto_storage.getStoredKeyPair = function(keyName) {
		var res = storage.getEncrypted("25519Key" + keyName);
		if (res === undefined)
			return undefined;
		return { pubKey: toArrayBuffer(res.pubKey), privKey: toArrayBuffer(res.privKey) };
	}

	crypto_storage.getAndRemoveStoredKeyPair = function(keyName) {
		var keyPair = this.getStoredKeyPair(keyName);
		storage.removeEncrypted("25519Key" + keyName);
		return keyPair;
	}

	crypto_storage.getAndRemovePreKeyPair = function(keyId) {
		return this.getAndRemoveStoredKeyPair("preKey" + keyId);
	}

	crypto_storage.getIdentityPrivKey = function() {
		return this.getStoredKeyPair("identityKey").privKey;
	}

	crypto_storage.saveSession = function(encodedNumber, session) {
		var sessions = storage.getEncrypted("session" + getEncodedNumber(encodedNumber));
		if (sessions === undefined)
			sessions = {};

		var doDeleteSession = false;
		if (session.indexInfo.closed == -1)
			sessions.identityKey = session.indexInfo.remoteIdentityKey;
		else {
			doDeleteSession = (session.indexInfo.closed < (new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS));

			if (!doDeleteSession) {
				var keysLeft = false;
				for (key in session) {
					if (key != "indexInfo" && key != "indexInfo" && key != "oldRatchetList") {
						keysLeft = true;
						break;
					}
				}
				doDeleteSession = !keysLeft;
			}
		}

		if (doDeleteSession)
			delete sessions[getString(session.indexInfo.baseKey)];
		else
			sessions[getString(session.indexInfo.baseKey)] = session;

		storage.putEncrypted("session" + getEncodedNumber(encodedNumber), sessions);
	}

	crypto_storage.getOpenSession = function(encodedNumber) {
		var sessions = storage.getEncrypted("session" + getEncodedNumber(encodedNumber));
		if (sessions === undefined)
			return undefined;

		for (key in sessions) {
			if (key == "identityKey")
				continue;

			if (sessions[key].indexInfo.closed == -1)
				return sessions[key];
		}
		return undefined;
	}

	crypto_storage.getSessionByRemoteEphemeralKey = function(encodedNumber, remoteEphemeralKey) {
		var sessions = storage.getEncrypted("session" + getEncodedNumber(encodedNumber));
		if (sessions === undefined)
			return undefined;

		var searchKey = getString(remoteEphemeralKey);

		var openSession = undefined;
		for (key in sessions) {
			if (key == "identityKey")
				continue;

			if (sessions[key].indexInfo.closed == -1) {
				if (openSession !== undefined)
					throw new Error("Datastore inconsistensy: multiple open sessions for " + encodedNumber);
				openSession = sessions[key];
			}
			if (sessions[key][searchKey] !== undefined)
				return sessions[key];
		}
		if (openSession !== undefined)
			return openSession;

		return undefined;
	}


	crypto_storage.getSessionOrIdentityKeyByBaseKey = function(encodedNumber, baseKey) {
		var sessions = storage.getEncrypted("session" + getEncodedNumber(encodedNumber));
		if (sessions === undefined)
			return undefined;

		var preferredSession = sessions[getString(baseKey)];
		if (preferredSession !== undefined)
			return preferredSession;

		if (sessions.identityKey !== undefined)
			return { indexInfo: { remoteIdentityKey: sessions.identityKey } };

		throw new Error("Datastore inconsistency: session was stored without identity key");
	}


	/*****************************
	 *** Internal Crypto stuff ***
	 *****************************/
	testing_only.ECDHE = function(pubKey, privKey) {
		if (privKey === undefined || privKey.byteLength != 32)
			throw new Error("Invalid private key");

		if (pubKey === undefined || ((pubKey.byteLength != 33 || new Uint8Array(pubKey)[0] != 5) && pubKey.byteLength != 32))
			throw new Error("Invalid public key");
		if (pubKey.byteLength == 33)
			pubKey = pubKey.slice(1);
		else
			console.error("WARNING: Expected pubkey of length 33, please report the ST and client that generated the pubkey");

		return new Promise(function(resolve) {
			if (textsecure.nacl.USE_NACL) {
				postNaclMessage({command: "ECDHE", priv: privKey, pub: pubKey}).then(function(message) {
					resolve(message.res);
				});
			} else {
				resolve(toArrayBuffer(curve25519(new Uint16Array(privKey), new Uint16Array(pubKey))));
			}
		});
	}
	var ECDHE = function(pubKey, privKey) { return testing_only.ECDHE(pubKey, privKey); }

	testing_only.HKDF = function(input, salt, info) {
		// Specific implementation of RFC 5869 that only returns exactly 64 bytes
		return HmacSHA256(salt, input).then(function(PRK) {
			var infoBuffer = new ArrayBuffer(info.byteLength + 1 + 32);
			var infoArray = new Uint8Array(infoBuffer);
			infoArray.set(new Uint8Array(info), 32);
			infoArray[infoArray.length - 1] = 0;
			// TextSecure implements a slightly tweaked version of RFC 5869: the 0 and 1 should be 1 and 2 here
			return HmacSHA256(PRK, infoBuffer.slice(32)).then(function(T1) {
				infoArray.set(new Uint8Array(T1));
				infoArray[infoArray.length - 1] = 1;
				return HmacSHA256(PRK, infoBuffer).then(function(T2) {
					return [ T1, T2 ];
				});
			});
		});
	}

	var HKDF = function(input, salt, info) {
		// HKDF for TextSecure has a bit of additional handling - salts always end up being 32 bytes
		if (salt == '')
			salt = new ArrayBuffer(32);
		if (salt.byteLength != 32)
			throw new Error("Got salt of incorrect length");

		info = toArrayBuffer(info); // TODO: maybe convert calls?

		return testing_only.HKDF(input, salt, info);
	}

	var calculateMACWithVersionByte = function(data, key, version) {
		if (version === undefined)
			version = 1;

		var prependedData = new Uint8Array(data.byteLength + 1);
		prependedData[0] = version;
		prependedData.set(new Uint8Array(data), 1);

		return HmacSHA256(key, prependedData.buffer);
	}

	var verifyMACWithVersionByte = function(data, key, mac, version) {
		return calculateMACWithVersionByte(data, key, version).then(function(calculated_mac) {
			var macString = getString(mac);//TODO: Move away from strings for comparison?

			if (getString(calculated_mac).substring(0, macString.length) != macString)
				throw new Error("Bad MAC");
		});
	}

	var calculateMAC = function(data, key) {
		return HmacSHA256(key, data);
	}

	var verifyMAC = function(data, key, mac) {
		return calculateMAC(data, key).then(function(calculated_mac) {
			var macString = getString(mac);//TODO: Move away from strings for comparison?

			if (getString(calculated_mac).substring(0, macString.length) != macString)
				throw new Error("Bad MAC");
		});
	}

	/******************************
	 *** Ratchet implementation ***
	 ******************************/
	var calculateRatchet = function(session, remoteKey, sending) {
		var ratchet = session.currentRatchet;

		return ECDHE(remoteKey, toArrayBuffer(ratchet.ephemeralKeyPair.privKey)).then(function(sharedSecret) {
			return HKDF(sharedSecret, toArrayBuffer(ratchet.rootKey), "WhisperRatchet").then(function(masterKey) {
				if (sending)
					session[getString(ratchet.ephemeralKeyPair.pubKey)]	= { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
				else
					session[getString(remoteKey)]						= { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
				ratchet.rootKey = masterKey[0];
			});
		});
	}

	var initSession = function(isInitiator, ourEphemeralKey, encodedNumber, theirIdentityPubKey, theirEphemeralPubKey) {
		var ourIdentityPrivKey = crypto_storage.getIdentityPrivKey();

		var sharedSecret = new Uint8Array(32 * 3);
		return ECDHE(theirEphemeralPubKey, ourIdentityPrivKey).then(function(ecRes1) {
			function finishInit() {
				return ECDHE(theirEphemeralPubKey, ourEphemeralKey.privKey).then(function(ecRes) {
					sharedSecret.set(new Uint8Array(ecRes), 32 * 2);

					return HKDF(sharedSecret.buffer, '', "WhisperText").then(function(masterKey) {
						var session = {currentRatchet: { rootKey: masterKey[0], lastRemoteEphemeralKey: theirEphemeralPubKey },
										indexInfo: { remoteIdentityKey: theirIdentityPubKey, closed: -1 },
										oldRatchetList: []
									};

						// If we're initiating we go ahead and set our first sending ephemeral key now,
						// otherwise we figure it out when we first maybeStepRatchet with the remote's ephemeral key
						if (isInitiator) {
							return createNewKeyPair(false).then(function(ourSendingEphemeralKey) {
								session.currentRatchet.ephemeralKeyPair = ourSendingEphemeralKey;
								return calculateRatchet(session, theirEphemeralPubKey, true).then(function() {
									return session;
								});
							});
						} else {
							session.currentRatchet.ephemeralKeyPair = ourEphemeralKey;
							return session;
						}
					});
				});
			}

			if (isInitiator)
				return ECDHE(theirIdentityPubKey, ourEphemeralKey.privKey).then(function(ecRes2) {
					sharedSecret.set(new Uint8Array(ecRes1));
					sharedSecret.set(new Uint8Array(ecRes2), 32);
				}).then(finishInit);
			else
				return ECDHE(theirIdentityPubKey, ourEphemeralKey.privKey).then(function(ecRes2) {
					sharedSecret.set(new Uint8Array(ecRes1), 32);
					sharedSecret.set(new Uint8Array(ecRes2))
				}).then(finishInit);
		});
	}

	var closeSession = function(session) {
		// Clear any data which would allow session continuation:
		// Lock down current receive ratchet
		// TODO: Some kind of delete chainKey['key']
		// Delete current sending ratchet
		delete session[getString(session.currentRatchet.ephemeralKeyPair.pubKey)];
		// Delete current root key and our ephemeral key pair
		delete session.currentRatchet['rootKey'];
		delete session.currentRatchet['ephemeralKeyPair'];
		session.indexInfo.closed = new Date().getTime();
	}

	var initSessionFromPreKeyWhisperMessage = function(encodedNumber, message) {
		var preKeyPair = crypto_storage.getAndRemovePreKeyPair(message.preKeyId);

		var session = crypto_storage.getSessionOrIdentityKeyByBaseKey(encodedNumber, toArrayBuffer(message.baseKey));
		var open_session = crypto_storage.getOpenSession(encodedNumber);
		if (preKeyPair === undefined) {
			// Session may or may not be the correct one, but if its not, we can't do anything about it
			// ...fall through and let decryptWhisperMessage handle that case
			if (session !== undefined && session.currentRatchet !== undefined)
				return Promise.resolve([session, undefined]);
			else
				throw new Error("Missing preKey for PreKeyWhisperMessage");
		}
		if (session !== undefined) {
			// We already had a session/known identity key:
			if (getString(session.indexInfo.remoteIdentityKey) == getString(message.identityKey)) {
				// If the identity key matches the previous one, close the previous one and use the new one
				if (open_session !== undefined)
					closeSession(open_session); // To be returned and saved later
			} else {
				// ...otherwise create an error that the UI will pick up and ask the user if they want to re-negotiate
				// TODO: Save the message for possible later renegotiation
				var error = new Error("Received message with unknown identity key");
				error.name = "WarnTryAgainError";
				error.full_message = "The identity of the sender has changed. This may be malicious, or the sender may have simply reinstalled TextSecure.";
				throw new error;
			}
		}
		return initSession(false, preKeyPair, encodedNumber, toArrayBuffer(message.identityKey), toArrayBuffer(message.baseKey))
						.then(function(new_session) {
			// Note that the session is not actually saved until the very end of decryptWhisperMessage
			// ... to ensure that the sender actually holds the private keys for all reported pubkeys
			new_session.indexInfo.baseKey = message.baseKey;
			return [new_session, open_session];
		});;
	}

	var fillMessageKeys = function(chain, counter) {
		if (chain.chainKey.counter + 1000 < counter) //TODO: maybe 1000 is too low/high in some cases?
			return Promise.resolve(); // Stalker, much?

		if (chain.chainKey.counter >= counter)
			return Promise.resolve(); // Already calculated

		if (chain.chainKey.key === undefined)
			throw new Error("Got invalid request to extend chain after it was already closed");

		var key = toArrayBuffer(chain.chainKey.key);
		var byteArray = new Uint8Array(1);
		byteArray[0] = 1;
		return HmacSHA256(key, byteArray.buffer).then(function(mac) {
			byteArray[0] = 2;
			return HmacSHA256(key, byteArray.buffer).then(function(key) {
				chain.messageKeys[chain.chainKey.counter + 1] = mac;
				chain.chainKey.key = key
				chain.chainKey.counter += 1;
				return fillMessageKeys(chain, counter);
			});
		});
	}

	var removeOldChains = function(session) {
		// Sending ratchets are always removed when we step because we never need them again
		// Receiving ratchets are either removed if we step with all keys used up to previousCounter
		// and are otherwise added to the oldRatchetList, which we parse here and remove ratchets
		// older than a week (we assume the message was lost and move on with our lives at that point)
		var newList = [];
		for (var i = 0; i < session.oldRatchetList.length; i++) {
			var entry = session.oldRatchetList[i];
			var ratchet = getString(entry.ephemeralKey);
			console.log("Checking old chain with added time " + (entry.added/1000));
			if (!objectContainsKeys(session[ratchet].messageKeys) || entry.added < new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS) {
				delete session[ratchet];
				console.log("...deleted");
			} else
				newList[newList.length] = entry;
		}
		session.oldRatchetList = newList;
	}

	var maybeStepRatchet = function(session, remoteKey, previousCounter) {
		if (session[getString(remoteKey)] !== undefined)
			return Promise.resolve();

		var ratchet = session.currentRatchet;

		var finish = function() {
			return calculateRatchet(session, remoteKey, false).then(function() {
				// Now swap the ephemeral key and calculate the new sending chain
				var previousRatchet = getString(ratchet.ephemeralKeyPair.pubKey);
				if (session[previousRatchet] !== undefined) {
					ratchet.previousCounter = session[previousRatchet].chainKey.counter;
					delete session[previousRatchet];
				} else
					// TODO: This is just an idiosyncrasy upstream, which we match for testing
					// it should be changed upstream to something more reasonable.
					ratchet.previousCounter = 4294967295;

				return createNewKeyPair(false).then(function(keyPair) {
					ratchet.ephemeralKeyPair = keyPair;
					return calculateRatchet(session, remoteKey, true).then(function() {
						ratchet.lastRemoteEphemeralKey = remoteKey;
					});
				});
			});
		}

		var previousRatchet = session[getString(ratchet.lastRemoteEphemeralKey)];
		if (previousRatchet !== undefined) {
			return fillMessageKeys(previousRatchet, previousCounter).then(function() {
				delete previousRatchet.chainKey['key'];
				if (!objectContainsKeys(previousRatchet.messageKeys))
					delete session[getString(ratchet.lastRemoteEphemeralKey)];
				else
					session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: ratchet.lastRemoteEphemeralKey };
			}).then(finish);
		} else
			return finish();
	}

	// returns decrypted protobuf
	var decryptWhisperMessage = function(encodedNumber, messageBytes, session) {
		if (messageBytes[0] != String.fromCharCode((2 << 4) | 2))
			throw new Error("Bad version number on WhisperMessage");

		var messageProto = messageBytes.substring(1, messageBytes.length - 8);
		var mac = messageBytes.substring(messageBytes.length - 8, messageBytes.length);

		var message = decodeWhisperMessageProtobuf(messageProto);
		var remoteEphemeralKey = toArrayBuffer(message.ephemeralKey);

		if (session === undefined) {
			var session = crypto_storage.getSessionByRemoteEphemeralKey(encodedNumber, remoteEphemeralKey);
			if (session === undefined)
				throw new Error("No session found to decrypt message from " + encodedNumber);
		}

		return maybeStepRatchet(session, remoteEphemeralKey, message.previousCounter).then(function() {
			var chain = session[getString(message.ephemeralKey)];

			return fillMessageKeys(chain, message.counter).then(function() {
				return HKDF(toArrayBuffer(chain.messageKeys[message.counter]), '', "WhisperMessageKeys").then(function(keys) {
					delete chain.messageKeys[message.counter];

					return verifyMACWithVersionByte(toArrayBuffer(messageProto), keys[1], mac, (2 << 4) | 2).then(function() {
						var counter = intToArrayBuffer(message.counter);
						return window.crypto.subtle.decrypt({name: "AES-CTR", counter: counter}, keys[0], toArrayBuffer(message.ciphertext))
									.then(function(plaintext) {

							removeOldChains(session);
							delete session['pendingPreKey'];

							var finalMessage = decodePushMessageContentProtobuf(getString(plaintext));

							if ((finalMessage.flags & 1) == 1) // END_SESSION
								closeSession(session);

							crypto_storage.saveSession(encodedNumber, session);
							return finalMessage;
						});
					});
				});
			});
		});
	}

	/*************************
	 *** Public crypto API ***
	 *************************/
	// Decrypts message into a raw string
	self.decryptWebsocketMessage = function(message) {
		var signaling_key = storage.getEncrypted("signaling_key"); //TODO: in crypto_storage
		var aes_key = toArrayBuffer(signaling_key.substring(0, 32));
		var mac_key = toArrayBuffer(signaling_key.substring(32, 32 + 20));

		var decodedMessage = base64DecToArr(getString(message));
		if (new Uint8Array(decodedMessage)[0] != 1)
			throw new Error("Got bad version number: " + decodedMessage[0]);

		var iv = decodedMessage.slice(1, 1 + 16);
		var ciphertext = decodedMessage.slice(1 + 16, decodedMessage.byteLength - 10);
		var ivAndCiphertext = decodedMessage.slice(1, decodedMessage.byteLength - 10);
		var mac = decodedMessage.slice(decodedMessage.byteLength - 10, decodedMessage.byteLength);

		return verifyMACWithVersionByte(ivAndCiphertext, mac_key, mac).then(function() {
			return window.crypto.subtle.decrypt({name: "AES-CBC", iv: iv}, aes_key, ciphertext);
		});
	};

	self.decryptAttachment = function(encryptedBin, keys) {
		var aes_key = keys.slice(0, 32);
		var mac_key = keys.slice(32, 64);

		var iv = encryptedBin.slice(0, 32);
		var ciphertext = encryptedBin.slice(32, encryptedBin.byteLength - 32);
		var ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
		var mac = encryptedBin.slice(encryptedBin.byteLength - 32, encryptedBin.byteLength);

		return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
			return window.crypto.subtle.decrypt({name: "AES-CBC", iv: iv}, aes_key, ciphertext);
		});
	};

	self.handleIncomingPushMessageProto = function(proto) {
		switch(proto.type) {
		case 0: //TYPE_MESSAGE_PLAINTEXT
			return Promise.resolve({message: decodePushMessageContentProtobuf(getString(proto.message)), pushMessage:proto});
		case 1: //TYPE_MESSAGE_CIPHERTEXT
			return decryptWhisperMessage(proto.source, getString(proto.message)).then(function(result) {
				return {message: result, pushMessage: proto};
			});
		case 3: //TYPE_MESSAGE_PREKEY_BUNDLE
			if (proto.message.readUint8() != (2 << 4 | 2))
				throw new Error("Bad version byte");
			var preKeyProto = decodePreKeyWhisperMessageProtobuf(getString(proto.message));
			return initSessionFromPreKeyWhisperMessage(proto.source, preKeyProto).then(function(sessions) {
				return decryptWhisperMessage(proto.source, getString(preKeyProto.message), sessions[0]).then(function(result) {
					if (sessions[1] !== undefined)
						crypto_storage.saveSession(proto.source, sessions[1]);
					return {message: result, pushMessage: proto};
				});
			});
		}
	}

	// return Promise(encoded [PreKey]WhisperMessage)
	self.encryptMessageFor = function(deviceObject, pushMessageContent) {
		var session = crypto_storage.getOpenSession(deviceObject.encodedNumber);

		var doEncryptPushMessageContent = function() {
			var msg = new WhisperMessageProtobuf();
			var plaintext = toArrayBuffer(pushMessageContent.encode());

			msg.ephemeralKey = toArrayBuffer(session.currentRatchet.ephemeralKeyPair.pubKey);
			var chain = session[getString(msg.ephemeralKey)];

			return fillMessageKeys(chain, chain.chainKey.counter + 1).then(function() {
				return HKDF(toArrayBuffer(chain.messageKeys[chain.chainKey.counter]), '', "WhisperMessageKeys").then(function(keys) {
					delete chain.messageKeys[chain.chainKey.counter];
					msg.counter = chain.chainKey.counter;
					msg.previousCounter = session.currentRatchet.previousCounter;

					var counter = intToArrayBuffer(chain.chainKey.counter);
					return window.crypto.subtle.encrypt({name: "AES-CTR", counter: counter}, keys[0], plaintext).then(function(ciphertext) {
						msg.ciphertext = ciphertext;
						var encodedMsg = toArrayBuffer(msg.encode());

						return calculateMACWithVersionByte(encodedMsg, keys[1], (2 << 4) | 2).then(function(mac) {
							var result = new Uint8Array(encodedMsg.byteLength + 9);
							result[0] = (2 << 4) | 2;
							result.set(new Uint8Array(encodedMsg), 1);
							result.set(new Uint8Array(mac, 0, 8), encodedMsg.byteLength + 1);
							crypto_storage.saveSession(deviceObject.encodedNumber, session);
							return result;
						});
					});
				});
			});
		}

		var preKeyMsg = new PreKeyWhisperMessageProtobuf();
		preKeyMsg.identityKey = toArrayBuffer(crypto_storage.getStoredPubKey("identityKey"));
		preKeyMsg.preKeyId = deviceObject.preKeyId;
		preKeyMsg.registrationId = storage.getUnencrypted("registrationId");

		if (session === undefined) {
			return createNewKeyPair(false).then(function(baseKey) {
				preKeyMsg.baseKey = toArrayBuffer(baseKey.pubKey);
				return initSession(true, baseKey, deviceObject.encodedNumber,
									toArrayBuffer(deviceObject.identityKey), toArrayBuffer(deviceObject.publicKey))
							.then(function(new_session) {
					session = new_session;
					session.pendingPreKey = baseKey.pubKey;
					return doEncryptPushMessageContent().then(function(message) {
						preKeyMsg.message = message;
						var result = String.fromCharCode((2 << 4) | 2) + getString(preKeyMsg.encode());
						return {type: 3, body: result};
					});
				});
			});
		} else
			return doEncryptPushMessageContent().then(function(message) {
				if (session.pendingPreKey !== undefined) {
					preKeyMsg.baseKey = toArrayBuffer(session.pendingPreKey);
					preKeyMsg.message = message;
					var result = String.fromCharCode((2 << 4) | 2) + getString(preKeyMsg.encode());
					return {type: 3, body: result};
				} else
					return {type: 1, body: getString(message)};
			});
	}

	var GENERATE_KEYS_KEYS_GENERATED = 100;
	self.generateKeys = function() {
		var identityKey = crypto_storage.getStoredPubKey("identityKey");
		var identityKeyCalculated = function(pubKey) {
			identityKey = pubKey;

			var firstKeyId = storage.getEncrypted("maxPreKeyId", -1) + 1;
			storage.putEncrypted("maxPreKeyId", firstKeyId + GENERATE_KEYS_KEYS_GENERATED);

			if (firstKeyId > 16777000)
				return new Promise(function() { throw new Error("You crazy motherfucker") });

			var keys = {};
			keys.keys = [];

			var generateKey = function(keyId) {
				return crypto_storage.getNewPubKeySTORINGPrivKey("preKey" + keyId, false).then(function(pubKey) {
					keys.keys[keyId] = {keyId: keyId, publicKey: pubKey, identityKey: identityKey};
				});
			};

			var promises = [];
			for (var i = firstKeyId; i < firstKeyId + GENERATE_KEYS_KEYS_GENERATED; i++)
				promises[i] = generateKey(i);

			return Promise.all(promises).then(function() {
				// 0xFFFFFF == 16777215
				keys.lastResortKey = {keyId: 16777215, publicKey: crypto_storage.getStoredPubKey("preKey16777215"), identityKey: identityKey};//TODO: Rotate lastResortKey
				if (keys.lastResortKey.publicKey === undefined) {
					return crypto_storage.getNewPubKeySTORINGPrivKey("preKey16777215", false).then(function(pubKey) {
						keys.lastResortKey.publicKey = pubKey;
						return keys;
					});
				} else
					return keys;
			});
		}
		if (identityKey === undefined)
			return crypto_storage.getNewPubKeySTORINGPrivKey("identityKey", true).then(function(pubKey) { return identityKeyCalculated(pubKey); });
		else
			return identityKeyCalculated(identityKey);
	}

	self.testing_only = testing_only;
	return self;
}();
