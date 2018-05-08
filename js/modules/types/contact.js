const { omit, compact, map } = require('lodash');

exports.parseAndWriteContactAvatar = upgradeAttachment => async (
  contact,
  context = {}
) => {
  const { message } = context;
  const { avatar } = contact;
  const contactWithUpdatedAvatar =
    avatar && avatar.avatar
      ? Object.assign({}, contact, {
          avatar: Object.assign({}, avatar, {
            avatar: await upgradeAttachment(avatar.avatar, context),
          }),
        })
      : omit(contact, ['avatar']);

  // eliminates empty numbers, emails, and addresses; adds type if not provided
  const contactWithCleanedElements = parseContact(contactWithUpdatedAvatar);

  // We'll log if the contact is invalid, leave everything as-is
  validateContact(contactWithCleanedElements, {
    messageId: idForLogging(message),
  });

  return contactWithCleanedElements;
};

function parseContact(contact) {
  return Object.assign(
    {},
    omit(contact, ['avatar', 'number', 'email', 'address']),
    parseAvatar(contact.avatar),
    createArrayKey('number', compact(map(contact.number, cleanBasicItem))),
    createArrayKey('email', compact(map(contact.email, cleanBasicItem))),
    createArrayKey('address', compact(map(contact.address, cleanAddress)))
  );
}

function idForLogging(message) {
  return `${message.source}.${message.sourceDevice} ${message.sent_at}`;
}

function validateContact(contact, options = {}) {
  const { messageId } = options;
  const { name, number, email, address, organization } = contact;

  if ((!name || !name.displayName) && !organization) {
    console.log(
      `Message ${messageId}: Contact had neither 'displayName' nor 'organization'`
    );
    return false;
  }

  if (
    (!number || !number.length) &&
    (!email || !email.length) &&
    (!address || !address.length)
  ) {
    console.log(
      `Message ${messageId}: Contact had no included numbers, email or addresses`
    );
    return false;
  }

  return true;
}

function cleanBasicItem(item) {
  if (!item.value) {
    return null;
  }

  return Object.assign({}, item, {
    type: item.type || 1,
  });
}

function cleanAddress(address) {
  if (!address) {
    return null;
  }

  if (
    !address.street &&
    !address.pobox &&
    !address.neighborhood &&
    !address.city &&
    !address.region &&
    !address.postcode &&
    !address.country
  ) {
    return null;
  }

  return Object.assign({}, address, {
    type: address.type || 1,
  });
}

function parseAvatar(avatar) {
  if (!avatar) {
    return null;
  }

  return {
    avatar: Object.assign({}, avatar, {
      isProfile: avatar.isProfile || false,
    }),
  };
}

function createArrayKey(key, array) {
  if (!array || !array.length) {
    return null;
  }

  return {
    [key]: array,
  };
}
