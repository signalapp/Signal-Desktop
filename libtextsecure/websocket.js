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
;(function(){
    'use strict';

    /*
     * var socket = textsecure.websocket(url);
     *
     * Returns an adamantium-reinforced super socket, capable of sending
     * app-level keep alives and automatically reconnecting.
     *
     */

    window.textsecure.websocket = function (url) {
        var keepAliveTimer;
        var reconnectSemaphore = 0;
        var reconnectTimeout = 1000;
        var socket;
        var socketWrapper = {
            onmessage : function() {},
            onclose   : function() {},
            onerror   : function() {},
            getStatus : function() { return socket.readyState; }
        };
        var error;

        function resetKeepAliveTimer() {
            clearTimeout(keepAliveTimer);
            keepAliveTimer = setTimeout(function() {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(
                        new textsecure.protobuf.WebSocketMessage({
                            type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
                            request: { verb: 'GET', path: '/v1/keepalive' }
                        }).encode().toArrayBuffer()
                    );
                }

                resetKeepAliveTimer();
            }, 55000);
        };

        function onclose(e) {
            if (!error) {
                reconnectSemaphore--;
                setTimeout(connect, reconnectTimeout);
            }
            if (e !== 1000 ) { // CLOSE_NORMAL
                console.log('websocket closed', e.code);
            }
            socketWrapper.onclose(e);
        };

        function onerror(e) {
            error = e;
            console.log('websocket error');
            socketWrapper.onerror(e);
        };

        function onmessage(response) {
            socketWrapper.onmessage(response);
            resetKeepAliveTimer();
        };

        function send(msg) {
            resetKeepAliveTimer();
            socket.send(msg);
        };

        function connect() {
            clearTimeout(keepAliveTimer);
            if (++reconnectSemaphore <= 0) { return; }

            if (socket) { socket.close(); }
            socket = new WebSocket(url);

            socket.onopen      = resetKeepAliveTimer;
            socket.onerror     = onerror
            socket.onclose     = onclose;
            socket.onmessage   = onmessage;
            socketWrapper.send = send;
        };

        connect();
        return socketWrapper;
    };
})();
