const { omit, compact, map } = require('lodash');

const { toLogFormat } = require('./errors');
const { SignalService } = require('../../../ts/protobuf');

const DEFAULT_PHONE_TYPE = SignalService.DataMessage.Contact.Phone.Type.HOME;
const DEFAULT_EMAIL_TYPE = SignalService.DataMessage.Contact.Email.Type.HOME;
const DEFAULT_ADDRESS_TYPE =
  SignalService.DataMessage.Contact.PostalAddress.Type.HOME;

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
    createArrayKey('number', compact(map(contact.number, cleanPhoneItem))),
    createArrayKey('email', compact(map(contact.email, cleanEmailItem))),
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

function cleanPhoneItem(item) {
  if (!item.value) {
    return null;
  }

  return Object.assign({}, item, {
    type: item.type || DEFAULT_PHONE_TYPE,
  });
}

function cleanEmailItem(item) {
  if (!item.value) {
    return null;
  }

  return Object.assign({}, item, {
    type: item.type || DEFAULT_EMAIL_TYPE,
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
    type: address.type || DEFAULT_ADDRESS_TYPE,
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
