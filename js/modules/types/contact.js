const { omit, compact, map } = require('lodash');

const { toLogFormat } = require('./errors');

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

  const error = exports._validateContact(contactWithCleanedElements, {
    messageId: idForLogging(message),
  });
  if (error) {
    console.log(
      'Contact.parseAndWriteContactAvatar: contact was malformed.',
      toLogFormat(error)
    );
  }

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

exports._validateContact = (contact, options = {}) => {
  const { messageId } = options;
  const { name, number, email, address, organization } = contact;

  if ((!name || !name.displayName) && !organization) {
    return new Error(
      `Message ${messageId}: Contact had neither 'displayName' nor 'organization'`
    );
  }

  if (
    (!number || !number.length) &&
    (!email || !email.length) &&
    (!address || !address.length)
  ) {
    return new Error(
      `Message ${messageId}: Contact had no included numbers, email or addresses`
    );
  }

  return null;
};

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
