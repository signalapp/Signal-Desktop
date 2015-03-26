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
;(function() {
    'use strict';
    $('.notifications .on button').click(function() {
        Whisper.Notifications.disable();
        initOptions();
    });

    $('.notifications .off button').click(function() {
        Whisper.Notifications.enable(initOptions);
        initOptions();
    });

    function initOptions() {
        if (Whisper.Notifications.isEnabled()) {
            $('.notifications .on').show();
            $('.notifications .off').hide();
        } else {
            $('.notifications .on').hide();
            $('.notifications .off').show();
        }
    }

    $('.modal-container .cancel').click(function() {
        $('.modal-container').hide();
    });

    $(function() {
        if (textsecure.registration.isDone()) {
            $('#complete-number').text(textsecure.storage.user.getNumber());
            $('#setup-complete').show().addClass('in');
            initOptions();
        } else {
            $('#init-setup').show().addClass('in');
            $('#status').text("Connecting...");
            textsecure.protocol_wrapper.createIdentityKeyRecvSocket().then(function(cryptoInfo) {
                var qrCode = new QRCode(document.getElementById('qr'));
                var socket = textsecure.api.getTempWebsocket();
                new WebSocketResource(socket, function(request) {
                    if (request.path == "/v1/address" && request.verb == "PUT") {
                        var proto = textsecure.protobuf.ProvisioningUuid.decode(request.body);
                        var url = [ 'tsdevice:/', '?uuid=', proto.uuid, '&pub_key=',
                            encodeURIComponent(btoa(getString(cryptoInfo.pubKey))) ].join('');
                        $('#status').text('');
                        qrCode.makeCode(url);
                        request.respond(200, 'OK');
                    } else if (request.path == "/v1/message" && request.verb == "PUT") {
                        var envelope = textsecure.protobuf.ProvisionEnvelope.decode(request.body, 'binary');
                        cryptoInfo.decryptAndHandleDeviceInit(envelope).then(function(provisionMessage) {
                            $('.confirmation-dialog .number').text(provisionMessage.number);
                            $('.confirmation-dialog .cancel').click(function(e) {
                                localStorage.clear();
                            });
                            $('.confirmation-dialog .ok').click(function(e) {
                                e.stopPropagation();
                                $('.confirmation-dialog').hide();
                                $('.progress-dialog').show();
                                $('.progress-dialog .status').text('Registering new device...');
                                window.textsecure.registerSecondDevice(provisionMessage).then(function() {
                                    $('.progress-dialog .status').text('Generating keys...');
                                    var counter = 0;
                                    var myWorker = new Worker('/js/generate_keys.js');
                                    myWorker.postMessage({
                                        maxPreKeyId: textsecure.storage.get("maxPreKeyId", 0),
                                        signedKeyId: textsecure.storage.get("signedKeyId", 0),
                                        libaxolotl25519KeyidentityKey: textsecure.storage.get("libaxolotl25519KeyidentityKey"),
                                    });
                                    myWorker.onmessage = function(e) {
                                        switch(e.data.method) {
                                            case 'set':
                                                textsecure.storage.put(e.data.key, e.data.value);
                                                counter = counter + 1;
                                                $('.progress-dialog .bar').css('width', (counter * 100 / 105) + '%');
                                                break;
                                            case 'remove':
                                                textsecure.storage.remove(e.data.key);
                                                break;
                                            case 'done':
                                                $('.progress-dialog .status').text('Uploading keys...');
                                                textsecure.api.registerKeys(e.data.keys).then(function() {
                                                    textsecure.registration.done();
                                                    $('.modal-container').hide();
                                                    $('#init-setup').hide();
                                                    $('#setup-complete').show().addClass('in');
                                                    initOptions();
                                                });
                                        }
                                    };
                                });
                            });
                            $('.modal-container').show();
                        });
                    } else
                        console.log(request.path);
                });
            });
        }
    });
})();
