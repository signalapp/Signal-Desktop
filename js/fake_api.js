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

//TODO: Redo this (API has changed to textsecure.api and changed)
var FakeWhisperAPI = function() {
	var doAjax = function(param) {
		if (param.success_callback) {
			setTimeout(param.success_callback, 100, param.response);
		}
	}

	this.getKeysForNumber = function(number, success_callback, error_callback) {
		doAjax({ success_callback	: success_callback,
						response		: [{ identityKey	: 1,
											deviceId		: 1,
											publicKey		: 1,
											keyId			: 1 }]
		});
	}

	this.sendMessages = function(jsonData, success_callback, error_callback) {
		doAjax({ success_callback	: success_callback,
						response		: { missingDeviceIds: [] }
		});
	}
};

FakeWhisperAPI.prototype = API;
API = new FakeWhisperAPI();

