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

function KeepAlive(websocketResource, socket) {
    if (websocketResource instanceof WebSocketResource) {
        this.wsr = websocketResource;
        this.socket = socket;
        this.reset();
    } else {
        throw new TypeError('KeepAlive expected a WebSocketResource');
    }
}

KeepAlive.prototype = {
    constructor: KeepAlive,
    reset: function() {
        clearTimeout(this.keepAliveTimer);
        clearTimeout(this.disconnectTimer);
        this.keepAliveTimer = setTimeout(function() {
            this.disconnectTimer = setTimeout(this.socket.close, 10000);
            this.wsr.sendRequest({
                verb: 'GET',
                path: '/v1/keepalive',
                success: this.reset.bind(this)
            });
        }.bind(this), 55000);
    },
};
