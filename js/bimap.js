/*global $, Whisper, Backbone, textsecure, extension*/
/* vim: ts=4:sw=4:expandtab:
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


// A bidirectional hash that allows constant-time lookup for
//  key -> value and value -> key
(function () {
	'use strict';

  window.Whisper = window.Whisper || {};

	function Bimap (map1, map2) {
		if (typeof map1 !== 'string' || typeof map2 !== 'string') {
			throw 'Expected two map name strings as arguments';
		}

		this.bijection = {};
		this.bijection[map1] = map2;
		this.bijection[map2] = map1;

		// makes accessing the maps clearer
		this[map1] = {};
		this[map2] = {};

		this[map1 + 'From'] = function (key) { return this[map2][key]; };
		this[map2 + 'From'] = function (key) { return this[map1][key]; };
	}

	Bimap.prototype.add = function (obj) {
		if (typeof obj !== 'object') {
			throw 'Expected an object as an argument';
		}

		var keys = Object.keys(obj);
		var map1 = keys[0];
		var map2 = keys[1];

		if (this.bijection[map1] !== map2) {
			throw 'Expected the argument\'s keys to correspond to the Bimap\'s two map names';
		}

		this[map1][obj[map1]] = obj[map2];
		this[map2][obj[map2]] = obj[map1];
	};

	Bimap.prototype.remove = function remove (map, key) {
		var bijection = this.bijection[map];
		var correspondingKey = this[map][key];

		// delete from the bijection
		delete this[bijection][correspondingKey];

		// delete from the specified map
		delete this[map][key];

		return correspondingKey;
	};

	// export
	Whisper.Bimap = Bimap;
})();
