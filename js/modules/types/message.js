const { isFunction, isString, omit } = require('lodash');

const Contact = require('./contact');
const Attachment = require('./attachment');
const Errors = require('./errors');
const SchemaVersion = require('./schema_version');
const {
  initializeAttachmentMetadata,
} = require('../../../ts/types/message/initializeAttachmentMetadata');
const MessageTS = require('../../../ts/types/Message');

const GROUP = 'group';
const PRIVATE = 'private';

// Schema version history
//
// Version 0
//   - Schema initialized
// Version 1
//   - Attachments: Auto-orient JPEG attachments using EXIF `Orientation` data.
//     N.B. The process of auto-orient for JPEGs strips (loses) all existing
//     EXIF metadata improving privacy, e.g. geolocation, camera make, etc.
// Version 2
//   - Attachments: Sanitize Unicode order override characters.
// Version 3
//   - Attachments: Write attachment data to disk and store relative path to it.
// Version 4
//   - Quotes: Write thumbnail data to disk and store relative path to it.
// Version 5 (deprecated)
//   - Attachments: Track number and kind of attachments for media gallery
//     - `hasAttachments?: 1 | 0`
//     - `hasVisualMediaAttachments?: 1 | undefined` (for media gallery ‘Media’ view)
//     - `hasFileAttachments?: 1 | undefined` (for media gallery ‘Documents’ view)
//   - IMPORTANT: Version 7 changes the classification of visual media and files.
//     Therefore version 5 is considered deprecated. For an easier implementation,
//     new files have the same classification in version 5 as in version 7.
// Version 6
//   - Contact: Write contact avatar to disk, ensure contact data is well-formed
// Version 7 (supersedes attachment classification in version 5)
//   - Attachments: Update classification for:
//     - `hasVisualMediaAttachments`: Include all images and video regardless of
//       whether Chromium can render it or not.
//     - `hasFileAttachments`: Exclude voice messages.

const INITIAL_SCHEMA_VERSION = 0;

// Public API
exports.GROUP = GROUP;
exports.PRIVATE = PRIVATE;

// Placeholder until we have stronger preconditions:
exports.isValid = () => true;

// Schema
exports.initializeSchemaVersion = message => {
  const isInitialized =
    SchemaVersion.isValid(message.schemaVersion) && message.schemaVersion >= 1;
  if (isInitialized) {
    return message;
  }

  const numAttachments = Array.isArray(message.attachments)
    ? message.attachments.length
    : 0;
  const hasAttachments = numAttachments > 0;
  if (!hasAttachments) {
    return Object.assign({}, message, {
      schemaVersion: INITIAL_SCHEMA_VERSION,
    });
  }

  // All attachments should have the same schema version, so we just pick
  // the first one:
  const firstAttachment = message.attachments[0];
  const inheritedSchemaVersion = SchemaVersion.isValid(
    firstAttachment.schemaVersion
  )
    ? firstAttachment.schemaVersion
    : INITIAL_SCHEMA_VERSION;
  const messageWithInitialSchema = Object.assign({}, message, {
    schemaVersion: inheritedSchemaVersion,
    attachments: message.attachments.map(Attachment.removeSchemaVersion),
  });

  return messageWithInitialSchema;
};

// Middleware
// type UpgradeStep = (Message, Context) -> Promise Message

// SchemaVersion -> UpgradeStep -> UpgradeStep
exports._withSchemaVersion = (schemaVersion, upgrade) => {
  if (!SchemaVersion.isValid(schemaVersion)) {
    throw new TypeError("'schemaVersion' is invalid");
  }
  if (!isFunction(upgrade)) {
    throw new TypeError("'upgrade' must be a function");
  }

  return async (message, context) => {
    if (!exports.isValid(message)) {
      console.log(
        'Message._withSchemaVersion: Invalid input message:',
        message
      );
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

    return Object.assign({}, upgradedMessage, { schemaVersion });
  };
};

// Public API
//      _mapAttachments :: (Attachment -> Promise Attachment) ->
//                         (Message, Context) ->
//                         Promise Message
exports._mapAttachments = upgradeAttachment => async (message, context) => {
  const upgradeWithContext = attachment =>
    upgradeAttachment(attachment, context);
  const attachments = await Promise.all(
    message.attachments.map(upgradeWithContext)
  );
  return Object.assign({}, message, { attachments });
};

// Public API
//      _mapContact :: (Contact -> Promise Contact) ->
//                     (Message, Context) ->
//                     Promise Message
exports._mapContact = upgradeContact => async (message, context) => {
  const contextWithMessage = Object.assign({}, context, { message });
  const upgradeWithContext = contact =>
    upgradeContact(contact, contextWithMessage);
  const contact = await Promise.all(
    (message.contact || []).map(upgradeWithContext)
  );
  return Object.assign({}, message, { contact });
};

//      _mapQuotedAttachments :: (QuotedAttachment -> Promise QuotedAttachment) ->
//                               (Message, Context) ->
//                               Promise Message
exports._mapQuotedAttachments = upgradeAttachment => async (
  message,
  context
) => {
  if (!message.quote) {
    return message;
  }

  const upgradeWithContext = async attachment => {
    const { thumbnail } = attachment;
    if (!thumbnail) {
      return attachment;
    }

    if (!thumbnail.data) {
      console.log('Quoted attachment did not have thumbnail data; removing it');
      return omit(attachment, ['thumbnail']);
    }

    const upgradedThumbnail = await upgradeAttachment(thumbnail, context);
    return Object.assign({}, attachment, {
      thumbnail: upgradedThumbnail,
    });
  };

  const quotedAttachments = (message.quote && message.quote.attachments) || [];

  const attachments = await Promise.all(
    quotedAttachments.map(upgradeWithContext)
  );
  return Object.assign({}, message, {
    quote: Object.assign({}, message.quote, {
      attachments,
    }),
  });
};

const toVersion0 = async message => exports.initializeSchemaVersion(message);
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
const toVersion4 = exports._withSchemaVersion(
  4,
  exports._mapQuotedAttachments(Attachment.migrateDataToFileSystem)
);
const toVersion5 = exports._withSchemaVersion(5, initializeAttachmentMetadata);
const toVersion6 = exports._withSchemaVersion(
  6,
  exports._mapContact(
    Contact.parseAndWriteAvatar(Attachment.migrateDataToFileSystem)
  )
);
// IMPORTANT: We’ve updated our definition of `initializeAttachmentMetadata`, so
// we need to run it again on existing items that have previously been incorrectly
// classified:
const toVersion7 = exports._withSchemaVersion(7, initializeAttachmentMetadata);

const VERSIONS = [
  toVersion0,
  toVersion1,
  toVersion2,
  toVersion3,
  toVersion4,
  toVersion5,
  toVersion6,
  toVersion7,
];
exports.CURRENT_SCHEMA_VERSION = VERSIONS.length - 1;

// UpgradeStep
exports.upgradeSchema = async (
  rawMessage,
  { writeNewAttachmentData, getRegionCode } = {}
) => {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError('`context.writeNewAttachmentData` is required');
  }
  if (!isFunction(getRegionCode)) {
    throw new TypeError('`context.getRegionCode` is required');
  }

  let message = rawMessage;
  // eslint-disable-next-line no-restricted-syntax
  for (const currentVersion of VERSIONS) {
    // We really do want this intra-loop await because this is a chained async action,
    //   each step dependent on the previous
    // eslint-disable-next-line no-await-in-loop
    message = await currentVersion(message, {
      writeNewAttachmentData,
      regionCode: getRegionCode(),
    });
  }

  return message;
};

exports.createAttachmentLoader = loadAttachmentData => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('`loadAttachmentData` is required');
  }

  return async message =>
    Object.assign({}, message, {
      attachments: await Promise.all(
        message.attachments.map(loadAttachmentData)
      ),
    });
};

//      createAttachmentDataWriter :: (RelativePath -> IO Unit)
//                                    Message ->
//                                    IO (Promise Message)
exports.createAttachmentDataWriter = writeExistingAttachmentData => {
  if (!isFunction(writeExistingAttachmentData)) {
    throw new TypeError("'writeExistingAttachmentData' must be a function");
  }

  return async rawMessage => {
    if (!exports.isValid(rawMessage)) {
      throw new TypeError("'rawMessage' is not valid");
    }

    const message = exports.initializeSchemaVersion(rawMessage);

    const { attachments, quote, contact } = message;
    const hasFilesToWrite =
      (quote && quote.attachments && quote.attachments.length > 0) ||
      (attachments && attachments.length > 0) ||
      (contact && contact.length > 0);

    if (!hasFilesToWrite) {
      return message;
    }

    const lastVersionWithAttachmentDataInMemory = 2;
    const willAttachmentsGoToFileSystemOnUpgrade =
      message.schemaVersion <= lastVersionWithAttachmentDataInMemory;
    if (willAttachmentsGoToFileSystemOnUpgrade) {
      return message;
    }

    (attachments || []).forEach(attachment => {
      if (!Attachment.hasData(attachment)) {
        throw new TypeError(
          "'attachment.data' is required during message import"
        );
      }

      if (!isString(attachment.path)) {
        throw new TypeError(
          "'attachment.path' is required during message import"
        );
      }
    });

    const writeThumbnails = exports._mapQuotedAttachments(async thumbnail => {
      const { data, path } = thumbnail;

      // we want to be bulletproof to thumbnails without data
      if (!data || !path) {
        console.log(
          'Thumbnail had neither data nor path.',
          'id:',
          message.id,
          'source:',
          message.source
        );
        return thumbnail;
      }

      await writeExistingAttachmentData(thumbnail);
      return omit(thumbnail, ['data']);
    });

    const writeContactAvatar = async messageContact => {
      const { avatar } = messageContact;
      if (avatar && !avatar.avatar) {
        return omit(messageContact, ['avatar']);
      }

      await writeExistingAttachmentData(avatar.avatar);

      return Object.assign({}, messageContact, {
        avatar: Object.assign({}, avatar, {
          avatar: omit(avatar.avatar, ['data']),
        }),
      });
    };

    const messageWithoutAttachmentData = Object.assign(
      {},
      await writeThumbnails(message),
      {
        contact: await Promise.all((contact || []).map(writeContactAvatar)),
        attachments: await Promise.all(
          (attachments || []).map(async attachment => {
            await writeExistingAttachmentData(attachment);
            return omit(attachment, ['data']);
          })
        ),
      }
    );

    return messageWithoutAttachmentData;
  };
};

exports.hasExpiration = MessageTS.hasExpiration;
