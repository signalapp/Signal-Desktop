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
(function () {
    'use strict';

    function clear(done) {
        var messages = new Whisper.MessageCollection();
        return messages.fetch().then(function() {
            messages.destroyAll();
            done();
        });
    }

    var attributes = { type: 'outgoing',
                        body: 'hi',
                        conversationId: 'foo',
                        attachments: [],
                        timestamp: new Date().getTime() };

    describe('MessageCollection', function() {
        before(clear);
        after(clear);

        it('adds without saving', function() {
            var messages = new Whisper.MessageCollection();
            var message = messages.add(attributes);
            assert.notEqual(messages.length, 0);

            var messages = new Whisper.MessageCollection();
            assert.strictEqual(messages.length, 0);
        });

        it('saves asynchronously', function(done) {
            new Whisper.MessageCollection().add(attributes).save().then(done);
        });

        it('fetches persistent messages', function(done) {
            var messages = new Whisper.MessageCollection();
            assert.strictEqual(messages.length, 0);
            messages.fetch().then(function() {
                assert.notEqual(messages.length, 0);
                var m = messages.at(0).attributes;
                _.each(attributes, function(val, key) {
                    assert.deepEqual(m[key], val);
                });
                done();
            });
        });

        it('destroys persistent messages', function(done) {
            var messages = new Whisper.MessageCollection();
            messages.fetch().then(function() {
                messages.destroyAll().then(function() {
                    var messages = new Whisper.MessageCollection();
                    messages.fetch().then(function() {
                        assert.strictEqual(messages.length, 0);
                        done();
                    });
                });
            });
        });

        it('should be ordered oldest to newest', function() {
            var messages = new Whisper.MessageCollection();
            // Timestamps
            var today = new Date();
            var tomorrow = new Date();
            tomorrow.setDate(today.getDate()+1);

            // Add threads
            messages.add({ timestamp: today });
            messages.add({ timestamp: tomorrow });

            var models = messages.models;
            var firstTimestamp = models[0].get('timestamp').getTime();
            var secondTimestamp = models[1].get('timestamp').getTime();

            // Compare timestamps
            assert(firstTimestamp < secondTimestamp);
        });

    });
})();
