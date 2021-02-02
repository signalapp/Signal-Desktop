const { omit, compact, map } = require('lodash');

const { toLogFormat } = require('./errors');
const { SignalService } = require('../../../ts/protobuf');

const DEFAULT_PHONE_TYPE = SignalService.DataMessage.Contact.Phone.Type.HOME;

exports.parseAndWriteAvatar = upgradeAttachment => async (
  contact,
  context = {}
) => {
  const { message, logger } = context;
  const { avatar } = contact;

  // This is to ensure that an omit() call doesn't pull in prototype props/methods
  const contactShallowCopy = Object.assign({}, contact);

  const contactWithUpdatedAvatar =
    avatar && avatar.avatar
      ? Object.assign({}, contactShallowCopy, {
          avatar: Object.assign({}, avatar, {
            avatar: await upgradeAttachment(avatar.avatar, context),
          }),
        })
      : omit(contactShallowCopy, ['avatar']);

  // eliminates empty numbers, emails, and addresses; adds type if not provided
  const parsedContact = parseContact(contactWithUpdatedAvatar);

  const error = exports._validate(parsedContact, {
    messageId: idForLogging(message),
  });
  if (error) {
    logger.error(
      'Contact.parseAndWriteAvatar: contact was malformed.',
      toLogFormat(error)
    );
  }

  return parsedContact;
};

function parseContact(contact) {
  const boundParsePhone = phoneNumber => parsePhoneItem(phoneNumber);

  return Object.assign(
    {},
    omit(contact, ['avatar', 'number', 'email', 'address']),
    parseAvatar(contact.avatar),
    createArrayKey('number', compact(map(contact.number, boundParsePhone)))
  );
}

function idForLogging(message) {
  return `${message.source}.${message.sourceDevice} ${message.sent_at}`;
}

exports._validate = (contact, options = {}) => {
  const { messageId } = options;
  const { name, number, organization } = contact;

  if ((!name || !name.displayName) && !organization) {
    return new Error(
      `Message ${messageId}: Contact had neither 'displayName' nor 'organization'`
    );
  }

  if (!number || !number.length) {
    return new Error(`Message ${messageId}: Contact had no included numbers`);
  }

  return null;
};

function parsePhoneItem(item) {
  if (!item.value) {
    return null;
  }

  return Object.assign({}, item, {
    type: item.type || DEFAULT_PHONE_TYPE,
    value: item.value,
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
