const { isFunction, isObject, isString, omit } = require('lodash');

const Attachment = require('./attachment');
const Errors = require('./errors');
const SchemaVersion = require('./schema_version');
const {
  initializeAttachmentMetadata,
} = require('../../../ts/types/message/initializeAttachmentMetadata');
const Contact = require('./contact');

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
// Version 8
//   - Attachments: Capture video/image dimensions and thumbnails, as well as a
//       full-size screenshot for video.
// Version 9
//   - Attachments: Expand the set of unicode characters we filter out of
//     attachment filenames
// Version 10
//   - Preview: A new type of attachment can be included in a message.

const INITIAL_SCHEMA_VERSION = 0;

// Public API
exports.GROUP = GROUP;
exports.PRIVATE = PRIVATE;

// Placeholder until we have stronger preconditions:
exports.isValid = () => true;

// Schema
exports.initializeSchemaVersion = ({ message, logger }) => {
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
    attachments: message.attachments.map(attachment =>
      Attachment.removeSchemaVersion({ attachment, logger })
    ),
  });

  return messageWithInitialSchema;
};

// Middleware
// type UpgradeStep = (Message, Context) -> Promise Message

// SchemaVersion -> UpgradeStep -> UpgradeStep
exports._withSchemaVersion = ({ schemaVersion, upgrade }) => {
  if (!SchemaVersion.isValid(schemaVersion)) {
    throw new TypeError('_withSchemaVersion: schemaVersion is invalid');
  }
  if (!isFunction(upgrade)) {
    throw new TypeError('_withSchemaVersion: upgrade must be a function');
  }

  return async (message, context) => {
    if (!context || !isObject(context.logger)) {
      throw new TypeError(
        '_withSchemaVersion: context must have logger object'
      );
    }
    const { logger } = context;

    if (!exports.isValid(message)) {
      logger.error(
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
      logger.warn(
        'WARNING: Message._withSchemaVersion: Unexpected version:',
        `Expected message to have version ${expectedVersion},`,
        `but got ${message.schemaVersion}.`
      );
      return message;
    }

    let upgradedMessage;
    try {
      upgradedMessage = await upgrade(message, context);
    } catch (error) {
      logger.error(
        `Message._withSchemaVersion: error updating message ${message.id}:`,
        Errors.toLogFormat(error)
      );
      return message;
    }

    if (!exports.isValid(upgradedMessage)) {
      logger.error(
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
    (message.attachments || []).map(upgradeWithContext)
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
  if (!context || !isObject(context.logger)) {
    throw new Error('_mapQuotedAttachments: context must have logger object');
  }

  const upgradeWithContext = async attachment => {
    const { thumbnail } = attachment;
    if (!thumbnail) {
      return attachment;
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

//      _mapPreviewAttachments :: (PreviewAttachment -> Promise PreviewAttachment) ->
//                               (Message, Context) ->
//                               Promise Message
exports._mapPreviewAttachments = upgradeAttachment => async (
  message,
  context
) => {
  if (!message.preview) {
    return message;
  }
  if (!context || !isObject(context.logger)) {
    throw new Error('_mapPreviewAttachments: context must have logger object');
  }

  const upgradeWithContext = async preview => {
    const { image } = preview;
    if (!image) {
      return preview;
    }

    const upgradedImage = await upgradeAttachment(image, context);
    return Object.assign({}, preview, {
      image: upgradedImage,
    });
  };

  const preview = await Promise.all(
    (message.preview || []).map(upgradeWithContext)
  );
  return Object.assign({}, message, {
    preview,
  });
};

const toVersion0 = async (message, context) =>
  exports.initializeSchemaVersion({ message, logger: context.logger });
const toVersion1 = exports._withSchemaVersion({
  schemaVersion: 1,
  upgrade: exports._mapAttachments(Attachment.autoOrientJPEG),
});
const toVersion2 = exports._withSchemaVersion({
  schemaVersion: 2,
  upgrade: exports._mapAttachments(Attachment.replaceUnicodeOrderOverrides),
});
const toVersion3 = exports._withSchemaVersion({
  schemaVersion: 3,
  upgrade: exports._mapAttachments(Attachment.migrateDataToFileSystem),
});
const toVersion4 = exports._withSchemaVersion({
  schemaVersion: 4,
  upgrade: exports._mapQuotedAttachments(Attachment.migrateDataToFileSystem),
});
const toVersion5 = exports._withSchemaVersion({
  schemaVersion: 5,
  upgrade: initializeAttachmentMetadata,
});
const toVersion6 = exports._withSchemaVersion({
  schemaVersion: 6,
  upgrade: exports._mapContact(
    Contact.parseAndWriteAvatar(Attachment.migrateDataToFileSystem)
  ),
});
// IMPORTANT: We’ve updated our definition of `initializeAttachmentMetadata`, so
// we need to run it again on existing items that have previously been incorrectly
// classified:
const toVersion7 = exports._withSchemaVersion({
  schemaVersion: 7,
  upgrade: initializeAttachmentMetadata,
});

const toVersion8 = exports._withSchemaVersion({
  schemaVersion: 8,
  upgrade: exports._mapAttachments(Attachment.captureDimensionsAndScreenshot),
});

const toVersion9 = exports._withSchemaVersion({
  schemaVersion: 9,
  upgrade: exports._mapAttachments(Attachment.replaceUnicodeV2),
});
const toVersion10 = exports._withSchemaVersion({
  schemaVersion: 10,
  upgrade: exports._mapPreviewAttachments(Attachment.migrateDataToFileSystem),
});

const VERSIONS = [
  toVersion0,
  toVersion1,
  toVersion2,
  toVersion3,
  toVersion4,
  toVersion5,
  toVersion6,
  toVersion7,
  toVersion8,
  toVersion9,
  toVersion10,
];
exports.CURRENT_SCHEMA_VERSION = VERSIONS.length - 1;

// We need dimensions and screenshots for images for proper display
exports.VERSION_NEEDED_FOR_DISPLAY = 9;

// UpgradeStep
exports.upgradeSchema = async (
  rawMessage,
  {
    writeNewAttachmentData,
    getAbsoluteAttachmentPath,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
    logger,
    maxVersion = exports.CURRENT_SCHEMA_VERSION,
  } = {}
) => {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError('context.writeNewAttachmentData is required');
  }
  if (!isFunction(getAbsoluteAttachmentPath)) {
    throw new TypeError('context.getAbsoluteAttachmentPath is required');
  }
  if (!isFunction(makeObjectUrl)) {
    throw new TypeError('context.makeObjectUrl is required');
  }
  if (!isFunction(revokeObjectUrl)) {
    throw new TypeError('context.revokeObjectUrl is required');
  }
  if (!isFunction(getImageDimensions)) {
    throw new TypeError('context.getImageDimensions is required');
  }
  if (!isFunction(makeImageThumbnail)) {
    throw new TypeError('context.makeImageThumbnail is required');
  }
  if (!isFunction(makeVideoScreenshot)) {
    throw new TypeError('context.makeVideoScreenshot is required');
  }
  if (!isObject(logger)) {
    throw new TypeError('context.logger is required');
  }

  let message = rawMessage;
  // eslint-disable-next-line no-restricted-syntax
  for (let index = 0, max = VERSIONS.length; index < max; index += 1) {
    if (maxVersion < index) {
      break;
    }

    const currentVersion = VERSIONS[index];
    // We really do want this intra-loop await because this is a chained async action,
    //   each step dependent on the previous
    // eslint-disable-next-line no-await-in-loop
    message = await currentVersion(message, {
      writeNewAttachmentData,
      getAbsoluteAttachmentPath,
      makeObjectUrl,
      revokeObjectUrl,
      getImageDimensions,
      makeImageThumbnail,
      makeVideoScreenshot,
      logger,
    });
  }

  return message;
};

// Runs on attachments outside of the schema upgrade process, since attachments are
//   downloaded out of band.
exports.processNewAttachment = async (
  attachment,
  {
    writeNewAttachmentData,
    getAbsoluteAttachmentPath,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
    logger,
  } = {}
) => {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError('context.writeNewAttachmentData is required');
  }
  if (!isFunction(getAbsoluteAttachmentPath)) {
    throw new TypeError('context.getAbsoluteAttachmentPath is required');
  }
  if (!isFunction(makeObjectUrl)) {
    throw new TypeError('context.makeObjectUrl is required');
  }
  if (!isFunction(revokeObjectUrl)) {
    throw new TypeError('context.revokeObjectUrl is required');
  }
  if (!isFunction(getImageDimensions)) {
    throw new TypeError('context.getImageDimensions is required');
  }
  if (!isFunction(makeImageThumbnail)) {
    throw new TypeError('context.makeImageThumbnail is required');
  }
  if (!isFunction(makeVideoScreenshot)) {
    throw new TypeError('context.makeVideoScreenshot is required');
  }
  if (!isObject(logger)) {
    throw new TypeError('context.logger is required');
  }

  const rotatedAttachment = await Attachment.autoOrientJPEG(attachment);
  const onDiskAttachment = await Attachment.migrateDataToFileSystem(
    rotatedAttachment,
    { writeNewAttachmentData }
  );
  const finalAttachment = await Attachment.captureDimensionsAndScreenshot(
    onDiskAttachment,
    {
      writeNewAttachmentData,
      getAbsoluteAttachmentPath,
      makeObjectUrl,
      revokeObjectUrl,
      getImageDimensions,
      makeImageThumbnail,
      makeVideoScreenshot,
      logger,
    }
  );

  return finalAttachment;
};

exports.createAttachmentLoader = loadAttachmentData => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError(
      'createAttachmentLoader: loadAttachmentData is required'
    );
  }

  return async message =>
    Object.assign({}, message, {
      attachments: await Promise.all(
        message.attachments.map(loadAttachmentData)
      ),
    });
};

exports.loadQuoteData = loadAttachmentData => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('loadQuoteData: loadAttachmentData is required');
  }

  return async quote => {
    if (!quote) {
      return null;
    }

    return {
      ...quote,
      attachments: await Promise.all(
        (quote.attachments || []).map(async attachment => {
          const { thumbnail } = attachment;

          if (!thumbnail || !thumbnail.path) {
            return attachment;
          }

          return {
            ...attachment,
            thumbnail: await loadAttachmentData(thumbnail),
          };
        })
      ),
    };
  };
};

exports.loadPreviewData = loadAttachmentData => {
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError('loadPreviewData: loadAttachmentData is required');
  }

  return async preview => {
    if (!preview || !preview.length) {
      return [];
    }

    return Promise.all(
      preview.map(async item => {
        if (!item.image) {
          return item;
        }

        return {
          ...item,
          image: await loadAttachmentData(item.image),
        };
      })
    );
  };
};

exports.deleteAllExternalFiles = ({ deleteAttachmentData, deleteOnDisk }) => {
  if (!isFunction(deleteAttachmentData)) {
    throw new TypeError(
      'deleteAllExternalFiles: deleteAttachmentData must be a function'
    );
  }

  if (!isFunction(deleteOnDisk)) {
    throw new TypeError(
      'deleteAllExternalFiles: deleteOnDisk must be a function'
    );
  }

  return async message => {
    const { attachments, quote, contact, preview } = message;

    if (attachments && attachments.length) {
      await Promise.all(attachments.map(deleteAttachmentData));
    }

    if (quote && quote.attachments && quote.attachments.length) {
      await Promise.all(
        quote.attachments.map(async attachment => {
          const { thumbnail } = attachment;

          // To prevent spoofing, we copy the original image from the quoted message.
          //   If so, it will have a 'copied' field. We don't want to delete it if it has
          //   that field set to true.
          if (thumbnail && thumbnail.path && !thumbnail.copied) {
            await deleteOnDisk(thumbnail.path);
          }
        })
      );
    }

    if (contact && contact.length) {
      await Promise.all(
        contact.map(async item => {
          const { avatar } = item;

          if (avatar && avatar.avatar && avatar.avatar.path) {
            await deleteOnDisk(avatar.avatar.path);
          }
        })
      );
    }

    if (preview && preview.length) {
      await Promise.all(
        preview.map(async item => {
          const { image } = item;

          if (image && image.path) {
            await deleteOnDisk(image.path);
          }
        })
      );
    }
  };
};

//      createAttachmentDataWriter :: (RelativePath -> IO Unit)
//                                    Message ->
//                                    IO (Promise Message)
exports.createAttachmentDataWriter = ({
  writeExistingAttachmentData,
  logger,
}) => {
  if (!isFunction(writeExistingAttachmentData)) {
    throw new TypeError(
      'createAttachmentDataWriter: writeExistingAttachmentData must be a function'
    );
  }
  if (!isObject(logger)) {
    throw new TypeError('createAttachmentDataWriter: logger must be an object');
  }

  return async rawMessage => {
    if (!exports.isValid(rawMessage)) {
      throw new TypeError("'rawMessage' is not valid");
    }

    const message = exports.initializeSchemaVersion({
      message: rawMessage,
      logger,
    });

    const { attachments, quote, contact, preview } = message;
    const hasFilesToWrite =
      (quote && quote.attachments && quote.attachments.length > 0) ||
      (attachments && attachments.length > 0) ||
      (contact && contact.length > 0) ||
      (preview && preview.length > 0);

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
        logger.warn(
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

    const writePreviewImage = async item => {
      const { image } = item;
      if (!image) {
        return omit(item, ['image']);
      }

      await writeExistingAttachmentData(image);

      return Object.assign({}, item, {
        image: omit(image, ['data']),
      });
    };

    const messageWithoutAttachmentData = Object.assign(
      {},
      await writeThumbnails(message, { logger }),
      {
        contact: await Promise.all((contact || []).map(writeContactAvatar)),
        preview: await Promise.all((preview || []).map(writePreviewImage)),
        attachments: await Promise.all(
          (attachments || []).map(async attachment => {
            await writeExistingAttachmentData(attachment);

            if (attachment.screenshot && attachment.screenshot.data) {
              await writeExistingAttachmentData(attachment.screenshot);
            }
            if (attachment.thumbnail && attachment.thumbnail.data) {
              await writeExistingAttachmentData(attachment.thumbnail);
            }

            return {
              ...omit(attachment, ['data']),
              ...(attachment.thumbnail
                ? { thumbnail: omit(attachment.thumbnail, ['data']) }
                : null),
              ...(attachment.screenshot
                ? { screenshot: omit(attachment.screenshot, ['data']) }
                : null),
            };
          })
        ),
      }
    );

    return messageWithoutAttachmentData;
  };
};
