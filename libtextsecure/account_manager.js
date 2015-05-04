/* vim: ts=4:sw=4:expandtab
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


;(function () {
    'use strict';
    window.textsecure = window.textsecure || {};

    function AccountManager() {
    }

    AccountManager.prototype = {
        constructor: AccountManager,
        requestVoiceVerification: function(number) {
            return TextSecureServer.requestVerificationVoice(number);
        },
        requestSMSVerification: function(number) {
            return TextSecureServer.requestVerificationSMS(number);
        },
        registerSingleDevice: function(number, verificationCode) {
            return axolotl.util.generateIdentityKeyPair().then(function(identityKeyPair) {
                return createAccount(number, verificationCode, identityKeyPair, true).
                    then(function() { return generateKeys(100); }).
                    then(TextSecureServer.registerKeys).
                    then(textsecure.registration.done);
            });
        },
        registerSecondDevice: function(setProvisioningUrl, confirmNumber, progressCallback) {
            return textsecure.protocol_wrapper.createIdentityKeyRecvSocket().then(function(cryptoInfo) {
                return new Promise(function(resolve) {
                    new WebSocketResource(textsecure.api.getTempWebsocket(), function(request) {
                        if (request.path == "/v1/address" && request.verb == "PUT") {
                            var proto = textsecure.protobuf.ProvisioningUuid.decode(request.body);
                            setProvisioningUrl([
                                'tsdevice:/?uuid=', proto.uuid, '&pub_key=',
                                encodeURIComponent(btoa(getString(cryptoInfo.pubKey)))
                            ].join(''));
                            request.respond(200, 'OK');
                        } else if (request.path == "/v1/message" && request.verb == "PUT") {
                            var envelope = textsecure.protobuf.ProvisionEnvelope.decode(request.body, 'binary');
                            request.respond(200, 'OK');
                            resolve(cryptoInfo.decryptAndHandleDeviceInit(envelope).then(function(provisionMessage) {
                                return confirmNumber(provisionMessage.number).then(function() {
                                    return createAccount(
                                        provisionMessage.number,
                                        provisionMessage.provisioningCode,
                                        provisionMessage.identityKeyPair,
                                        false
                                    );
                                });
                            }));
                        } else {
                            console.log('Unknown websocket message', request.path);
                        }
                    });
                });
            }).then(function() {
                return generateKeys(100, progressCallback);
            }).then(TextSecureServer.registerKeys).then(textsecure.registration.done);
        },
        refreshPreKeys: function() {
            return textsecure.api.getMyKeys().then(function(preKeyCount) {
                if (preKeyCount < 10) {
                    return generateKeys(100);
                }
            });
        }
    };
    function createAccount(number, verificationCode, identityKeyPair, single_device) {
        textsecure.storage.put('identityKey', identityKeyPair);

        var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
        textsecure.storage.put('signaling_key', signalingKey);

        var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
        password = password.substring(0, password.length - 2);
        textsecure.storage.put("password", password);

        var registrationId = axolotl.util.generateRegistrationId();
        textsecure.storage.put("registrationId", registrationId);

        return textsecure.api.confirmCode(
            number, verificationCode, password, signalingKey, registrationId, single_device
        ).then(function(response) {
            textsecure.storage.user.setNumberAndDeviceId(number, response.deviceId || 1);
            textsecure.storage.put("regionCode", libphonenumber.util.getRegionCodeForNumber(number));
        });
    }

    textsecure.AccountManager = AccountManager;

}());

function generateKeys(count, progressCallback) {
    if (typeof progressCallback !== 'function') {
        progressCallback = undefined;
    }
    var startId = textsecure.storage.get('maxPreKeyId', 1);
    var signedKeyId = textsecure.storage.get('signedKeyId', 1);

    if (typeof startId != 'number') {
        throw new Error('Invalid maxPreKeyId');
    }
    if (typeof signedKeyId != 'number') {
        throw new Error('Invalid signedKeyId');
    }

    textsecure.protocol_wrapper.startWorker();

    var store = textsecure.storage.axolotl;
    var identityKey = store.getMyIdentityKey();
    var result = { preKeys: [], identityKey: identityKey.pubKey };
    var promises = [];

    for (var keyId = startId; keyId < startId+count; ++keyId) {
        promises.push(
            axolotl.util.generatePreKey(keyId).then(function(res) {
                store.putPreKey(res.keyId, res.keyPair);
                result.preKeys.push({
                    keyId     : res.keyId,
                    publicKey : res.keyPair.pubKey
                });
                if (progressCallback) { progressCallback(); }
            })
        );
    }

    promises.push(
        axolotl.util.generateSignedPreKey(identityKey, signedKeyId).then(function(res) {
            store.putSignedPreKey(res.keyId, res.keyPair);
            result.signedPreKey = {
                keyId     : res.keyId,
                publicKey : res.keyPair.pubKey,
                signature : res.signature
            };
        })
    );

    store.removeSignedPreKey(signedKeyId - 2);
    textsecure.storage.put('maxPreKeyId', startId + count);
    textsecure.storage.put('signedKeyId', signedKeyId + 1);
    return Promise.all(promises).then(function() {
        textsecure.protocol_wrapper.stopWorker();
        return result;
    });
}
