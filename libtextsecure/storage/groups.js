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

;(function() {
    /*********************
     *** Group Storage ***
     *********************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.groups = {
        createNewGroup: function(numbers, groupId) {
            if (groupId !== undefined && textsecure.storage.getEncrypted("group" + groupId) !== undefined)
                throw new Error("Tried to recreate group");

            while (groupId === undefined || textsecure.storage.getEncrypted("group" + groupId) !== undefined)
                groupId = getString(textsecure.crypto.getRandomBytes(16));

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            var haveMe = false;
            var finalNumbers = [];
            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in group");
                if (number == me)
                    haveMe = true;
                if (finalNumbers.indexOf(number) < 0)
                    finalNumbers.push(number);
            }

            if (!haveMe)
                finalNumbers.push(me);

            var groupObject = {numbers: finalNumbers, numberRegistrationIds: {}};
            for (var i in finalNumbers)
                groupObject.numberRegistrationIds[finalNumbers[i]] = {};

            textsecure.storage.putEncrypted("group" + groupId, groupObject);

            return {id: groupId, numbers: finalNumbers};
        },

        getNumbers: function(groupId) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            return group.numbers;
        },

        removeNumber: function(groupId, number) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            if (number == me)
                throw new Error("Cannot remove ourselves from a group, leave the group instead");

            var i = group.numbers.indexOf(number);
            if (i > -1) {
                group.numbers.slice(i, 1);
                delete group.numberRegistrationIds[number];
                textsecure.storage.putEncrypted("group" + groupId, group);
            }

            return group.numbers;
        },

        addNumbers: function(groupId, numbers) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in set to add to group");
                if (group.numbers.indexOf(number) < 0) {
                    group.numbers.push(number);
                    group.numberRegistrationIds[number] = {};
                }
            }

            textsecure.storage.putEncrypted("group" + groupId, group);
            return group.numbers;
        },

        deleteGroup: function(groupId) {
            textsecure.storage.removeEncrypted("group" + groupId);
        },

        getGroup: function(groupId) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            return { id: groupId, numbers: group.numbers }; //TODO: avatar/name tracking
        },

        needUpdateByDeviceRegistrationId: function(groupId, number, encodedNumber, registrationId) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                throw new Error("Unknown group for device registration id");

            if (group.numberRegistrationIds[number] === undefined)
                throw new Error("Unknown number in group for device registration id");

            if (group.numberRegistrationIds[number][encodedNumber] == registrationId)
                return false;

            var needUpdate = group.numberRegistrationIds[number][encodedNumber] !== undefined;
            group.numberRegistrationIds[number][encodedNumber] = registrationId;
            textsecure.storage.putEncrypted("group" + groupId, group);
            return needUpdate;
        },
    };
})();
