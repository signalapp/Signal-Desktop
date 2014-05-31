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

var getKeysForNumberMap = {};
textsecure.api.getKeysForNumber = function(number) {
	var res = getKeysForNumberMap[number];
	if (res !== undefined) {
		delete getKeysForNumberMap[number];
		return Promise.resolve(res);
	} else
		throw new Error("getKeysForNumber of unknown/used number");
}

var messagesSentMap = {};
textsecure.api.sendMessages = function(destination, messageArray) {
	for (i in messageArray) {
		var msg = messageArray[i];
		if ((msg.type != 1 && msg.type != 3) ||
				msg.destinationDeviceId === undefined ||
				msg.destinationRegistrationId === undefined ||
				msg.body === undefined ||
				msg.timestamp == undefined ||
				msg.relay !== undefined)
			throw new Error("Invalid message");

		messagesSentMap[destination + "." + messageArray[i].destinationDeviceId] = msg;
	}
}
