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

describe('Device storage', function() {
    before(function() { localStorage.clear(); });
    var store = textsecure.storage.axolotl;
    var identifier = '+5558675309';
    var another_identifier = '+5555590210';
    var identityKey = {
        pubKey: textsecure.crypto.getRandomBytes(33),
        privKey: textsecure.crypto.getRandomBytes(32),
    };
    var testKey = {
        pubKey: textsecure.crypto.getRandomBytes(33),
        privKey: textsecure.crypto.getRandomBytes(32),
    };
    describe('saveKeysToDeviceObject', function() {
        it('rejects if the identity key changes', function(done) {
            return textsecure.storage.devices.saveKeysToDeviceObject({
                identityKey: identityKey.pubKey,
                encodedNumber: identifier + '.1'
            }).then(function() {
                textsecure.storage.devices.saveKeysToDeviceObject({
                    identityKey: testKey.pubKey,
                    encodedNumber: identifier + '.1'
                }).then(function() {
                    done(new Error('Allowed to overwrite identity key'));
                }).catch(function(e) {
                    assert.strictEqual(e.message, 'Identity key changed');
                    done();
                });
            });
        });
    });
});
