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


describe('curve25519_compiled.js', function() {
    describe('curve25519_donna', function() {
        it('exists', function() {
            var curve25519_donna = Module.cwrap('curve25519_sign', 'string', 'string');
            assert.isDefined(Module.cwrap);
        });
    });
    test_curve25519_implementation(curve25519);
});
