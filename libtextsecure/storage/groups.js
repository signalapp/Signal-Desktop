/* global window, getString, libsignal, textsecure */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  /** *******************
   *** Group Storage ***
   ******************** */
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  // create a random group id that we haven't seen before.
  function generateNewGroupId() {
    const groupId = getString(libsignal.crypto.getRandomBytes(16));
    return textsecure.storage.protocol.getGroup(groupId).then(group => {
      if (group === undefined) {
        return groupId;
      }
      window.log.warn('group id collision'); // probably a bad sign.
      return generateNewGroupId();
    });
  }

  window.textsecure.storage.groups = {
    createNewGroup(numbers, groupId) {
      return new Promise(resolve => {
        if (groupId !== undefined) {
          resolve(
            textsecure.storage.protocol.getGroup(groupId).then(group => {
              if (group !== undefined) {
                throw new Error('Tried to recreate group');
              }
            })
          );
        } else {
          resolve(
            generateNewGroupId().then(newGroupId => {
              // eslint-disable-next-line no-param-reassign
              groupId = newGroupId;
            })
          );
        }
      }).then(() => {
        const me = textsecure.storage.user.getNumber();
        let haveMe = false;
        const finalNumbers = [];
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const i in numbers) {
          const number = numbers[i];
          if (!textsecure.utils.isNumberSane(number))
            throw new Error('Invalid number in group');
          if (number === me) haveMe = true;
          if (finalNumbers.indexOf(number) < 0) finalNumbers.push(number);
        }

        if (!haveMe) finalNumbers.push(me);

        const groupObject = {
          numbers: finalNumbers,
          numberRegistrationIds: {},
        };
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const i in finalNumbers) {
          groupObject.numberRegistrationIds[finalNumbers[i]] = {};
        }

        return textsecure.storage.protocol
          .putGroup(groupId, groupObject)
          .then(() => ({ id: groupId, numbers: finalNumbers }));
      });
    },

    getNumbers(groupId) {
      return textsecure.storage.protocol.getGroup(groupId).then(group => {
        if (!group) {
          return undefined;
        }

        return group.numbers;
      });
    },

    removeNumber(groupId, number) {
      return textsecure.storage.protocol.getGroup(groupId).then(group => {
        if (group === undefined) return undefined;

        const me = textsecure.storage.user.getNumber();
        if (number === me)
          throw new Error(
            'Cannot remove ourselves from a group, leave the group instead'
          );

        const i = group.numbers.indexOf(number);
        if (i > -1) {
          group.numbers.splice(i, 1);
          // eslint-disable-next-line no-param-reassign
          delete group.numberRegistrationIds[number];
          return textsecure.storage.protocol
            .putGroup(groupId, group)
            .then(() => group.numbers);
        }

        return group.numbers;
      });
    },

    addNumbers(groupId, numbers) {
      return textsecure.storage.protocol.getGroup(groupId).then(group => {
        if (group === undefined) return undefined;

        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const i in numbers) {
          const number = numbers[i];
          if (!textsecure.utils.isNumberSane(number))
            throw new Error('Invalid number in set to add to group');
          if (group.numbers.indexOf(number) < 0) {
            group.numbers.push(number);
            // eslint-disable-next-line no-param-reassign
            group.numberRegistrationIds[number] = {};
          }
        }

        return textsecure.storage.protocol
          .putGroup(groupId, group)
          .then(() => group.numbers);
      });
    },

    deleteGroup(groupId) {
      return textsecure.storage.protocol.removeGroup(groupId);
    },

    getGroup(groupId) {
      return textsecure.storage.protocol.getGroup(groupId).then(group => {
        if (group === undefined) return undefined;

        return { id: groupId, numbers: group.numbers };
      });
    },

    updateNumbers(groupId, numbers) {
      return textsecure.storage.protocol.getGroup(groupId).then(group => {
        if (group === undefined)
          throw new Error('Tried to update numbers for unknown group');

        if (
          numbers.filter(textsecure.utils.isNumberSane).length < numbers.length
        )
          throw new Error('Invalid number in new group members');

        const added = numbers.filter(
          number => group.numbers.indexOf(number) < 0
        );

        return textsecure.storage.groups.addNumbers(groupId, added);
      });
    },
  };
})();
