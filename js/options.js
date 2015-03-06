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
    $(function() {
        if (textsecure.registration.isDone()) {
            $('#complete-number').text(
                textsecure.utils.unencodeNumber(
                    textsecure.storage.getUnencrypted("number_id")
                )[0]
            );//TODO: no
            $('#setup-complete').show().addClass('in');
        } else {
            $('#init-setup').show().addClass('in');
            $('#status').text("Connecting...");
            axolotl.protocol.createIdentityKeyRecvSocket().then(function(cryptoInfo) {
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
                        $('#qr').hide();
                        textsecure.registerSecondDevice(request.body, cryptoInfo, function(step) {
                            switch(step) {
                            case 1:
                                $('#status').text('Registering new device...');
                                break;
                            case 2:
                                $('#status').text('Generating keys...');
                                break;
                            case 3:
                                $('#status').text('Uploading keys...');
                                break;
                            case 4:
                                $('#status').text('All done!');
                                textsecure.registration.done();
                                $('#init-setup').hide();
                                $('#setup-complete').show().addClass('in');
                            }
                        });
                    } else
                        console.log(request.path);
                });
            });
        }
    });
})();
