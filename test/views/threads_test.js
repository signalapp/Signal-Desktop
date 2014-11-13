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

describe('Threads', function() {

  it('should be ordered newest to oldest', function() {
    // Timestamps
    var today = new Date();
    var tomorrow = new Date();
    tomorrow.setDate(today.getDate()+1);

    // Add threads
    Whisper.Threads.add({ timestamp: today });
    Whisper.Threads.add({ timestamp: tomorrow });

    var models = Whisper.Threads.models;
    var firstTimestamp = models[0].get('timestamp').getTime();
    var secondTimestamp = models[1].get('timestamp').getTime();

    // Compare timestamps
    assert(firstTimestamp > secondTimestamp);
  });


});
