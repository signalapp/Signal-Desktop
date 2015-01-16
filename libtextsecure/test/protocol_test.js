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

'use strict';
describe('Protocol', function() {

    describe('Unencrypted PushMessageProto "decrypt"', function() {
        //exclusive
        it('works', function(done) {
            localStorage.clear();

            var text_message = new textsecure.protobuf.PushMessageContent();
            text_message.body = "Hi Mom";
            var server_message = {
                type: 4, // unencrypted
                source: "+19999999999",
                timestamp: 42,
                message: text_message.encode()
            };

            return textsecure.protocol_wrapper.handleIncomingPushMessageProto(server_message).
                then(function(message) {
                    assert.equal(message.body, text_message.body);
                    assert.equal(message.attachments.length, text_message.attachments.length);
                    assert.equal(text_message.attachments.length, 0);
                }).then(done).catch(done);
        });
    });

    // TODO: Use fake_api's hiding of api.sendMessage to test sendmessage.js' maze
});
