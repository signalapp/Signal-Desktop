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
        var socketWrapper = { onmessage: function() {}, ondisconnect: function() {} };
        var socket;
        var keepAliveTimer;
        var reconnectSemaphore = 0;
        var reconnectTimeout = 1000;

        function resetKeepAliveTimer() {
            clearTimeout(keepAliveTimer);
            keepAliveTimer = setTimeout(function() {
                socket.send(JSON.stringify({type: 1, id: 0}));
                resetKeepAliveTimer();
            }, 50000);
        };

        function reconnect(e) {
            reconnectSemaphore--;
            setTimeout(connect, reconnectTimeout);
            socketWrapper.ondisconnect(e);
        };

        var connect = function() {
            clearTimeout(keepAliveTimer);
            if (++reconnectSemaphore <= 0) { return; }

            if (socket) { socket.close(); }
            socket = new WebSocket(url);

            socket.onerror = reconnect;
            socket.onclose = reconnect;
            socket.onopen  = resetKeepAliveTimer;

            socket.onmessage = function(response) {
                socketWrapper.onmessage(response);
                resetKeepAliveTimer();
            };

            socketWrapper.send = function(msg) {
                socket.send(msg);
            }
        };

        connect();
        return socketWrapper;
    };
})();
