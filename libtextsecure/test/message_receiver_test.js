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
    var WebSocket = window.WebSocket;
    before(function() { window.WebSocket = MockSocket; });
    after (function() { window.WebSocket = WebSocket;  });
    it('connects', function(done) {
        var mockServer = new MockServer('ws://localhost:8080');
        var attrs = {
            type: textsecure.protobuf.Envelope.Type.PLAINTEXT,
            source: '+19999999999',
            sourceDevice: '1',
            timestamp: Date.now(),
        };
        mockServer.on('connection', function(server) {
            var signal = new textsecure.protobuf.Envelope(attrs);
            signal.message = new textsecure.protobuf.DataMessage({ body: 'hello' });
            server.send(
                new textsecure.protobuf.WebSocketMessage({
                    type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
                    request: { verb: 'PUT', path: '/messages', body: signal }
                }).encode().toArrayBuffer()
            );
        });

        window.addEventListener('signal', function(ev) {
            var signal = ev.proto;
            for (var key in attrs) {
                assert.strictEqual(attrs[key], signal[key]);
            }
            assert.strictEqual(signal.message.body, 'hello');
        });
        var messageReceiver = new textsecure.MessageReceiver(window);
        messageReceiver.connect();
    });
});
