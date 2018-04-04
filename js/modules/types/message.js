const { isFunction, isString, omit } = require('lodash');

const Attachment = require('./attachment');
const Errors = require('./errors');
const SchemaVersion = require('./schema_version');


const GROUP = 'group';
const PRIVATE = 'private';

// Schema version history
//
// Version 0
//   - Schema initialized
// Version 1
//   - Attachments: Auto-orient JPEG attachments using EXIF `Orientation` data.
// Version 2
//   - Attachments: Sanitize Unicode order override characters.
// Version 3
//   - Attachments: Write attachment data to disk and store relative path to it.

const INITIAL_SCHEMA_VERSION = 0;

// Increment this version number every time we add a message schema upgrade
// step. This will allow us to retroactively upgrade existing messages. As we
// add more upgrade steps, we could design a pipeline that does this
// incrementally, e.g. from version 0 / unknown -> 1, 1 --> 2, etc., similar to
// how we do database migrations:
exports.CURRENT_SCHEMA_VERSION = 3;


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
// type UpgradeStep = (Message, Context) -> Promise Message

// SchemaVersion -> UpgradeStep -> UpgradeStep
exports._withSchemaVersion = (schemaVersion, upgrade) => {
  if (!SchemaVersion.isValid(schemaVersion)) {
    throw new TypeError('"schemaVersion" is invalid');
  }
  if (!isFunction(upgrade)) {
    throw new TypeError('"upgrade" must be a function');
  }

  return async (message, context) => {
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
      upgradedMessage = await upgrade(message, context);
    } catch (error) {
      console.log(
        'Message._withSchemaVersion: error:',
        Errors.toLogFormat(error)
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
//                         (Message, Context) ->
//                         Promise Message
exports._mapAttachments = upgradeAttachment => async (message, context) => {
  const upgradeWithContext = attachment =>
    upgradeAttachment(attachment, context);
  const attachments = await Promise.all(message.attachments.map(upgradeWithContext));
  return Object.assign({}, message, { attachments });
};

const toVersion0 = async message =>
  exports.initializeSchemaVersion(message);

const toVersion1 = exports._withSchemaVersion(
  1,
  exports._mapAttachments(Attachment.autoOrientJPEG)
);
const toVersion2 = exports._withSchemaVersion(
  2,
  exports._mapAttachments(Attachment.replaceUnicodeOrderOverrides)
);
const toVersion3 = exports._withSchemaVersion(
  3,
  exports._mapAttachments(Attachment.migrateDataToFileSystem)
);

// UpgradeStep
exports.upgradeSchema = async (message, { writeNewAttachmentData } = {}) => {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError('`context.writeNewAttachmentData` is required');
  }

  return toVersion3(
    await toVersion2(await toVersion1(await toVersion0(message))),
    { writeNewAttachmentData }
  );
};

exports.createAttachmentLoader = (loadAttachmentData) => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('`loadAttachmentData` is required');
  }

  return async message => (Object.assign({}, message, {
    attachments: await Promise.all(message.attachments.map(loadAttachmentData)),
  }));
};

//      createAttachmentDataWriter :: (RelativePath -> IO Unit)
//                                    Message ->
//                                    IO (Promise Message)
exports.createAttachmentDataWriter = (writeExistingAttachmentData) => {
  if (!isFunction(writeExistingAttachmentData)) {
    throw new TypeError('"writeExistingAttachmentData" must be a function');
  }

  return async (rawMessage) => {
    if (!exports.isValid(rawMessage)) {
      throw new TypeError('"rawMessage" is not valid');
    }

    const message = exports.initializeSchemaVersion(rawMessage);

    const { attachments } = message;
    const hasAttachments = attachments && attachments.length > 0;
    if (!hasAttachments) {
      return message;
    }

    const lastVersionWithAttachmentDataInMemory = 2;
    const willHaveAttachmentsSavedOnFileSystemDuringUpgrade =
      message.schemaVersion <= lastVersionWithAttachmentDataInMemory;
    if (willHaveAttachmentsSavedOnFileSystemDuringUpgrade) {
      return message;
    }

    attachments.forEach((attachment) => {
      if (!Attachment.hasData(attachment)) {
        throw new TypeError('"attachment.data" is required during message import');
      }

      if (!isString(attachment.path)) {
        throw new TypeError('"attachment.path" is required during message import');
      }
    });

    const messageWithoutAttachmentData = Object.assign({}, message, {
      attachments: await Promise.all(attachments.map(async (attachment) => {
        await writeExistingAttachmentData(attachment);
        return omit(attachment, ['data']);
      })),
    });

    return messageWithoutAttachmentData;
  };
};
