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

describe('TextSecureWebSocket', function() {
    var WebSocket = window.WebSocket;
    before(function() { window.WebSocket = MockSocket; });
    after (function() { window.WebSocket = WebSocket;  });
    it('connects a websocket', function(done) {
        var mockServer = new MockServer('ws://localhost:8080');
        mockServer.on('connection', function(server) {
            server.on('message', function(data) {
                server.send('hello');
            });
        });

        var socket = new TextSecureWebSocket('ws://localhost:8080');
        socket.onmessage = function(response) {
            assert.strictEqual(response.data, 'hello');
            done();
        };
        socket.send('data');
    });

    it('sends a keepalive once a minute', function(done) {
        this.timeout(60000);
        var mockServer = new MockServer('ws://localhost:8080');
        mockServer.on('connection', function(server) {
            server.on('message', function(data) {
                var message = textsecure.protobuf.WebSocketMessage.decode(data);
                assert.strictEqual(message.type, textsecure.protobuf.WebSocketMessage.Type.REQUEST);
                assert.strictEqual(message.request.verb, 'GET');
                assert.strictEqual(message.request.path, '/v1/keepalive');
                done();
            });
        });
        var socket = new TextSecureWebSocket('ws://localhost:8080');
    });

    it('reconnects', function(done) {
        this.timeout(60000);
        var mockServer = new MockServer('ws://localhost:8080');
        var socket = new TextSecureWebSocket('ws://localhost:8080');
        socket.onclose = function() {
            var mockServer = new MockServer('ws://localhost:8080');
            mockServer.on('connection', function() {
                done();
            });
        };
        mockServer.close();
    });
});
