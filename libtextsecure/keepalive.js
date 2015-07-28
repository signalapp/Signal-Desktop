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

function KeepAlive(websocketResource, opts) {
    if (websocketResource instanceof WebSocketResource) {
        opts = opts || {};
        this.disconnect = opts.disconnect;
        if (this.disconnect === undefined) {
            this.disconnect = true;
        }
        this.wsr = websocketResource;
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
            this.wsr.sendRequest({
                verb: 'GET',
                path: '/v1/keepalive',
                success: this.reset.bind(this)
            });
            if (this.disconnect) {
                // automatically disconnect if server doesn't ack
                this.disconnectTimer = setTimeout(function() {
                    this.wsr.close(3001, 'No response to keepalive request');
                }.bind(this), 1000);
            } else {
                this.reset();
            }
        }.bind(this), 55000);
    },
};
