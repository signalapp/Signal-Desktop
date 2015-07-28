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

describe('MessageReceiver', function() {
    textsecure.storage.impl = new AxolotlStore();
    var WebSocket = window.WebSocket;
    var number = '+19999999999';
    var deviceId = 1;
    before(function() {
        window.WebSocket = MockSocket;
        textsecure.storage.user.setNumberAndDeviceId(number, deviceId, 'name');
        textsecure.storage.put("password", "password");
        var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
        textsecure.storage.put("signaling_key", signalingKey);
    });
    after (function() { window.WebSocket = WebSocket;  });

    describe('connecting', function() {
        var blob = null;
        var attrs = {
            type: textsecure.protobuf.Envelope.Type.CIPHERTEXT,
            source: number,
            sourceDevice: deviceId,
            timestamp: Date.now(),
        };
        var websocketmessage = new textsecure.protobuf.WebSocketMessage({
            type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
            request: { verb: 'PUT', path: '/messages' }
        });

        before(function(done) {
            var signal = new textsecure.protobuf.Envelope(attrs).toArrayBuffer();
            var data = new textsecure.protobuf.DataMessage({ body: 'hello' });

            var signaling_key = toArrayBuffer(textsecure.storage.get("signaling_key")); //TODO: in crypto_storage
            var aes_key = signaling_key.slice(0, 32);
            var mac_key = signaling_key.slice(32, 32 + 20);

            window.crypto.subtle.importKey('raw', aes_key, {name: 'AES-CBC'}, false, ['encrypt']).then(function(key) {
                var iv = textsecure.crypto.getRandomBytes(16);
                window.crypto.subtle.encrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, signal).then(function(ciphertext) {
                    window.crypto.subtle.importKey('raw', mac_key, {name: 'HMAC', hash: {name: 'SHA-256'}}, false, ['sign']).then(function(key) {
                        window.crypto.subtle.sign( {name: 'HMAC', hash: 'SHA-256'}, key, signal).then(function(mac) {
                            var version = new Uint8Array([1]);
                            var message = dcodeIO.ByteBuffer.concat([version, iv, ciphertext, mac ]);
                            websocketmessage.request.body = message.toArrayBuffer();
                            console.log(new Uint8Array(message.toArrayBuffer()));
                            done();
                        });
                    });
                });
            });
        });

        it('connects', function(done) {
            var mockServer = new MockServer('ws://localhost:8080/v1/websocket/?login='+ encodeURIComponent(number) +'.1&password=password');

            mockServer.on('connection', function(server) {
                server.send(new Blob([ websocketmessage.toArrayBuffer() ]));
            });

            window.addEventListener('textsecure:message', function(ev) {
                var signal = ev.proto;
                for (var key in attrs) {
                    assert.strictEqual(attrs[key], signal[key]);
                }
                assert.strictEqual(signal.message.body, 'hello');
                server.close();
                done();
            });
            var messageReceiver = new textsecure.MessageReceiver('ws://localhost:8080', window);
        });
    });
});
