const isFunction = require('lodash/isFunction');

const Attachment = require('./attachment');
const SchemaVersion = require('./schema_version');


const GROUP = 'group';
const PRIVATE = 'private';

const INITIAL_SCHEMA_VERSION = 0;

// Increment this version number every time we add a message schema upgrade
// step. This will allow us to retroactively upgrade existing messages. As we
// add more upgrade steps, we could design a pipeline that does this
// incrementally, e.g. from version 0 / unknown -> 1, 1 --> 2, etc., similar to
// how we do database migrations:
exports.CURRENT_SCHEMA_VERSION = 2;

// Schema version history
//
// Version 1
//   - Attachments: Auto-orient JPEG attachments using EXIF `Orientation` data
// Version 2
//   - Attachments: Sanitize Unicode order override characters

// Public API
exports.GROUP = GROUP;
exports.PRIVATE = PRIVATE;

// Placeholder until we have stronger preconditions:
exports.isValid = () =>
  true;

// Schema
exports.initializeSchemaVersion = (message) => {
  const isInitialized = SchemaVersion.isValid(message.schemaVersion) &&
    message.schemaVersion >= 1;
  if (isInitialized) {
    return message;
  }

  const numAttachments = Array.isArray(message.attachments)
    ? message.attachments.length
    : 0;
  const hasAttachments = numAttachments > 0;
  if (!hasAttachments) {
    return Object.assign(
      {},
      message,
      { schemaVersion: INITIAL_SCHEMA_VERSION }
    );
  }

  // All attachments should have the same schema version, so we just pick
  // the first one:
  const firstAttachment = message.attachments[0];
  const inheritedSchemaVersion = SchemaVersion.isValid(firstAttachment.schemaVersion)
    ? firstAttachment.schemaVersion
    : INITIAL_SCHEMA_VERSION;
  const messageWithInitialSchema = Object.assign(
    {},
    message,
    {
      schemaVersion: inheritedSchemaVersion,
      attachments: message.attachments.map(Attachment.removeSchemaVersion),
    }
  );

  return messageWithInitialSchema;
};

// Middleware
// type UpgradeStep = Message -> Promise Message

// SchemaVersion -> UpgradeStep -> UpgradeStep
exports._withSchemaVersion = (schemaVersion, upgrade) => {
  if (!SchemaVersion.isValid(schemaVersion)) {
    throw new TypeError('`schemaVersion` is invalid');
  }
  if (!isFunction(upgrade)) {
    throw new TypeError('`upgrade` must be a function');
  }

  return async (message) => {
    if (!exports.isValid(message)) {
      console.log('Message._withSchemaVersion: Invalid input message:', message);
      return message;
    }

    const isAlreadyUpgraded = message.schemaVersion >= schemaVersion;
    if (isAlreadyUpgraded) {
      return message;
    }

    const expectedVersion = schemaVersion - 1;
    const hasExpectedVersion = message.schemaVersion === expectedVersion;
    if (!hasExpectedVersion) {
      console.log(
        'WARNING: Message._withSchemaVersion: Unexpected version:',
        `Expected message to have version ${expectedVersion},`,
        `but got ${message.schemaVersion}.`,
        message
      );
      return message;
    }

    let upgradedMessage;
    try {
      upgradedMessage = await upgrade(message);
    } catch (error) {
      console.log(
        'Message._withSchemaVersion: error:',
        // TODO: Use `Errors.toLogFormat`:
        error && error.stack ? error.stack : error
      );
      return message;
    }

    if (!exports.isValid(upgradedMessage)) {
      console.log(
        'Message._withSchemaVersion: Invalid upgraded message:',
        upgradedMessage
      );
      return message;
    }

    return Object.assign(
      {},
      upgradedMessage,
      { schemaVersion }
    );
  };
};


// Public API
//      _mapAttachments :: (Attachment -> Promise Attachment) ->
//                         Message ->
//                         Promise Message
exports._mapAttachments = upgradeAttachment => async message =>
  Object.assign(
    {},
    message,
    {
      attachments: await Promise.all(message.attachments.map(upgradeAttachment)),
    }
  );

const toVersion1 = exports._withSchemaVersion(
  1,
  exports._mapAttachments(Attachment.autoOrientJPEG)
);
const toVersion2 = exports._withSchemaVersion(
  2,
  exports._mapAttachments(Attachment.replaceUnicodeOrderOverrides)
);

// UpgradeStep
exports.upgradeSchema = async message =>
  toVersion2(await toVersion1(message));
