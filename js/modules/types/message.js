const Attachment = require('./attachment');
const SchemaVersion = require('./schema_version');


const GROUP = 'group';
const PRIVATE = 'private';

const INITIAL_SCHEMA_VERSION = 0;

// Public API
exports.GROUP = GROUP;
exports.PRIVATE = PRIVATE;

// Schema
// Message -> Promise Message
exports.upgradeSchema = async message =>
  Object.assign({}, message, {
    attachments:
      await Promise.all(message.attachments.map(Attachment.upgradeSchema)),
  });

// Inherits existing schema from attachments:
exports.inheritSchemaVersion = (message) => {
  const isInitialized = SchemaVersion.isValid(message.schemaVersion) &&
    message.schemaVersion >= 1;
  if (isInitialized) {
    return message;
  }

  const numAttachments = Array.isArray(message.attachments)
    ? message.attachments.length : 0;
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
    ? firstAttachment.schemaVersion : INITIAL_SCHEMA_VERSION;
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
