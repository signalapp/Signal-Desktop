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
                return createAccount(number, verificationCode, identityKeyPair).
                    then(function() { return generateKeys(100); }).
                    then(TextSecureServer.registerKeys).
                    then(textsecure.registration.done).
                    then(textsecure.messaging.sendRequestContactSyncMessage).
                    then(textsecure.messaging.sendRequestGroupSyncMessage);
            });
        },
        registerSecondDevice: function(setProvisioningUrl, confirmNumber, progressCallback) {
            return textsecure.protocol_wrapper.createIdentityKeyRecvSocket().then(function(cryptoInfo) {
                return new Promise(function(resolve) {
                    var socket = TextSecureServer.getTempWebsocket();
                    var wsr = new WebSocketResource(socket, function(request) {
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
                            wsr.close();
                            resolve(cryptoInfo.decryptAndHandleDeviceInit(envelope).then(function(provisionMessage) {
                                return confirmNumber(provisionMessage.number).then(function(deviceName) {
                                    if (typeof deviceName !== 'string' || deviceName.length == 0) {
                                        throw new Error('Invalid device name');
                                    }
                                    return createAccount(
                                        provisionMessage.number,
                                        provisionMessage.provisioningCode,
                                        provisionMessage.identityKeyPair,
                                        deviceName
                                    );
                                });
                            }));
                        } else {
                            console.log('Unknown websocket message', request.path);
                        }
                    });
                    new KeepAlive(wsr, { disconnect: false });
                });
            }).then(function() {
                return generateKeys(100, progressCallback);
            }).then(TextSecureServer.registerKeys).
               then(textsecure.registration.done).
               then(textsecure.messaging.sendRequestContactSyncMessage);
        },
        refreshPreKeys: function() {
            return TextSecureServer.getMyKeys().then(function(preKeyCount) {
                if (preKeyCount < 10) {
                    return generateKeys(100).then(TextSecureServer.registerKeys);
                }
            });
        }
    };
    function createAccount(number, verificationCode, identityKeyPair, deviceName) {
        var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
        var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
        password = password.substring(0, password.length - 2);
        var registrationId = axolotl.util.generateRegistrationId();

        return TextSecureServer.confirmCode(
            number, verificationCode, password, signalingKey, registrationId, deviceName
        ).then(function(response) {
            textsecure.storage.remove('identityKey');
            textsecure.storage.remove('signaling_key');
            textsecure.storage.remove('password');
            textsecure.storage.remove('registrationId');
            textsecure.storage.remove('number_id');
            textsecure.storage.remove('regionCode');

            textsecure.storage.put('identityKey', identityKeyPair);
            textsecure.storage.put('signaling_key', signalingKey);
            textsecure.storage.put('password', password);
            textsecure.storage.put('registrationId', registrationId);

            textsecure.storage.user.setNumberAndDeviceId(number, response.deviceId || 1, deviceName);
            textsecure.storage.put('regionCode', libphonenumber.util.getRegionCodeForNumber(number));
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
    return store.getMyIdentityKey().then(function(identityKey) {
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
    });
}
