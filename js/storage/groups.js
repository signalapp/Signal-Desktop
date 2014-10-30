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
        getGroupListForNumber: function(number) {
            return textsecure.storage.getEncrypted("groupMembership" + number, []);
        },

        createNewGroup: function(numbers, groupId) {
            if (groupId !== undefined && textsecure.storage.getEncrypted("group" + groupId) !== undefined) {
                throw new Error("Tried to recreate group");
            }

            while (groupId === undefined || textsecure.storage.getEncrypted("group" + groupId) !== undefined) {
                groupId = getString(textsecure.crypto.getRandomBytes(16));
            }

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            var haveMe = false;
            var finalNumbers = [];
            for (var i in numbers) {
                var number = libphonenumber.util.verifyNumber(numbers[i]);
                if (number == me)
                    haveMe = true;
                if (finalNumbers.indexOf(number) < 0) {
                    finalNumbers.push(number);
                    addGroupToNumber(groupId, number);
                }
            }

            if (!haveMe)
                finalNumbers.push(me);

            textsecure.storage.putEncrypted("group" + groupId, {numbers: finalNumbers});

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

            try {
                number = libphonenumber.util.verifyNumber(number);
            } catch (e) {
                return group.numbers;
            }

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            if (number == me)
                throw new Error("Cannot remove ourselves from a group, leave the group instead");

            var i = group.numbers.indexOf(number);
            if (i > -1) {
                group.numbers.slice(i, 1);
                textsecure.storage.putEncrypted("group" + groupId, group);
                removeGroupFromNumber(groupId, number);
            }

            return group.numbers;
        },

        addNumbers: function(groupId, numbers) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            for (var i in numbers) {
                var number = libphonenumber.util.verifyNumber(numbers[i]);
                if (group.numbers.indexOf(number) < 0) {
                    group.numbers.push(number);
                    addGroupToNumber(groupId, number);
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
        }
    };

    var addGroupToNumber = function(groupId, number) {
        var membership = textsecure.storage.getEncrypted("groupMembership" + number, [groupId]);
        if (membership.indexOf(groupId) < 0)
            membership.push(groupId);
        textsecure.storage.putEncrypted("groupMembership" + number, membership);
    }

    var removeGroupFromNumber = function(groupId, number) {
        var membership = textsecure.storage.getEncrypted("groupMembership" + number, [groupId]);
        membership = membership.filter(function(group) { return group != groupId; });
        if (membership.length == 0)
            textsecure.storage.removeEncrypted("groupMembership" + number);
        else
            textsecure.storage.putEncrypted("groupMembership" + number, membership);
    }

})();
