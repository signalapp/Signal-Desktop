const is = require('@sindresorhus/is');

const AttachmentTS = require('../../../ts/types/Attachment');
const GoogleChrome = require('../../../ts/util/GoogleChrome');
const MIME = require('../../../ts/types/MIME');
const { toLogFormat } = require('./errors');
const {
  arrayBufferToBlob,
  blobToArrayBuffer,
  dataURLToBlob,
} = require('blob-util');
const { autoOrientImage } = require('../auto_orient_image');
const {
  migrateDataToFileSystem,
} = require('./attachment/migrate_data_to_file_system');

// // Incoming message attachment fields
// {
//   id: string
//   contentType: MIMEType
//   data: ArrayBuffer
//   digest: ArrayBuffer
//   fileName: string | null
//   flags: null
//   key: ArrayBuffer
//   size: integer
//   thumbnail: ArrayBuffer
// }

// // Outgoing message attachment fields
// {
//   contentType: MIMEType
//   data: ArrayBuffer
//   fileName: string
//   size: integer
// }

// Returns true if `rawAttachment` is a valid attachment based on our current schema.
// Over time, we can expand this definition to become more narrow, e.g. require certain
// fields, etc.
exports.isValid = rawAttachment => {
  // NOTE: We cannot use `_.isPlainObject` because `rawAttachment` is
  // deserialized by protobuf:
  if (!rawAttachment) {
    return false;
  }

  return true;
};

// Upgrade steps
// NOTE: This step strips all EXIF metadata from JPEG images as
// part of re-encoding the image:
exports.autoOrientJPEG = async attachment => {
  if (!MIME.isJPEG(attachment.contentType)) {
    return attachment;
  }

  const dataBlob = await arrayBufferToBlob(
    attachment.data,
    attachment.contentType
  );
  const newDataBlob = await dataURLToBlob(await autoOrientImage(dataBlob));
  const newDataArrayBuffer = await blobToArrayBuffer(newDataBlob);

  // IMPORTANT: We overwrite the existing `data` `ArrayBuffer` losing the original
  // image data. Ideally, we’d preserve the original image data for users who want to
  // retain it but due to reports of data loss, we don’t want to overburden IndexedDB
  // by potentially doubling stored image data.
  // See: https://github.com/signalapp/Signal-Desktop/issues/1589
  const newAttachment = Object.assign({}, attachment, {
    data: newDataArrayBuffer,
    size: newDataArrayBuffer.byteLength,
  });

  // `digest` is no longer valid for auto-oriented image data, so we discard it:
  delete newAttachment.digest;

  return newAttachment;
};

const UNICODE_LEFT_TO_RIGHT_OVERRIDE = '\u202D';
const UNICODE_RIGHT_TO_LEFT_OVERRIDE = '\u202E';
const UNICODE_REPLACEMENT_CHARACTER = '\uFFFD';
const INVALID_CHARACTERS_PATTERN = new RegExp(
  `[${UNICODE_LEFT_TO_RIGHT_OVERRIDE}${UNICODE_RIGHT_TO_LEFT_OVERRIDE}]`,
  'g'
);
// NOTE: Expose synchronous version to do property-based testing using `testcheck`,
// which currently doesn’t support async testing:
// https://github.com/leebyron/testcheck-js/issues/45
exports._replaceUnicodeOrderOverridesSync = attachment => {
  if (!is.string(attachment.fileName)) {
    return attachment;
  }

  const normalizedFilename = attachment.fileName.replace(
    INVALID_CHARACTERS_PATTERN,
    UNICODE_REPLACEMENT_CHARACTER
  );
  const newAttachment = Object.assign({}, attachment, {
    fileName: normalizedFilename,
  });

  return newAttachment;
};

exports.replaceUnicodeOrderOverrides = async attachment =>
  exports._replaceUnicodeOrderOverridesSync(attachment);

exports.removeSchemaVersion = ({ attachment, logger }) => {
  if (!exports.isValid(attachment)) {
    logger.error(
      'Attachment.removeSchemaVersion: Invalid input attachment:',
      attachment
    );
    return attachment;
  }

  const attachmentWithoutSchemaVersion = Object.assign({}, attachment);
  delete attachmentWithoutSchemaVersion.schemaVersion;
  return attachmentWithoutSchemaVersion;
};

exports.migrateDataToFileSystem = migrateDataToFileSystem;

//      hasData :: Attachment -> Boolean
exports.hasData = attachment =>
  attachment.data instanceof ArrayBuffer || ArrayBuffer.isView(attachment.data);

//      loadData :: (RelativePath -> IO (Promise ArrayBuffer))
//                  Attachment ->
//                  IO (Promise Attachment)
exports.loadData = readAttachmentData => {
  if (!is.function(readAttachmentData)) {
    throw new TypeError("'readAttachmentData' must be a function");
  }

  return async attachment => {
    if (!exports.isValid(attachment)) {
      throw new TypeError("'attachment' is not valid");
    }

    const isAlreadyLoaded = exports.hasData(attachment);
    if (isAlreadyLoaded) {
      return attachment;
    }

    if (!is.string(attachment.path)) {
      throw new TypeError("'attachment.path' is required");
    }

    const data = await readAttachmentData(attachment.path);
    return Object.assign({}, attachment, { data });
  };
};

//      deleteData :: (RelativePath -> IO Unit)
//                    Attachment ->
//                    IO Unit
exports.deleteData = deleteOnDisk => {
  if (!is.function(deleteOnDisk)) {
    throw new TypeError('deleteData: deleteOnDisk must be a function');
  }

  return async attachment => {
    if (!exports.isValid(attachment)) {
      throw new TypeError('deleteData: attachment is not valid');
    }

    const { path, thumbnail, screenshot } = attachment;
    if (is.string(path)) {
      await deleteOnDisk(path);
    }

    if (thumbnail && is.string(thumbnail.path)) {
      await deleteOnDisk(thumbnail.path);
    }

    if (screenshot && is.string(screenshot.path)) {
      await deleteOnDisk(screenshot.path);
    }
  };
};

exports.isVoiceMessage = AttachmentTS.isVoiceMessage;
exports.save = AttachmentTS.save;

const THUMBNAIL_SIZE = 150;
const THUMBNAIL_CONTENT_TYPE = 'image/png';

exports.captureDimensionsAndScreenshot = async (
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
  }
) => {
  const { contentType } = attachment;

  if (
    !GoogleChrome.isImageTypeSupported(contentType) &&
    !GoogleChrome.isVideoTypeSupported(contentType)
  ) {
    return attachment;
  }

  const absolutePath = await getAbsoluteAttachmentPath(attachment.path);

  if (GoogleChrome.isImageTypeSupported(contentType)) {
    try {
      const { width, height } = await getImageDimensions({
        objectUrl: absolutePath,
        logger,
      });
      const thumbnailBuffer = await blobToArrayBuffer(
        await makeImageThumbnail({
          size: THUMBNAIL_SIZE,
          objectUrl: absolutePath,
          contentType: THUMBNAIL_CONTENT_TYPE,
          logger,
        })
      );

      const thumbnailPath = await writeNewAttachmentData(thumbnailBuffer);
      return {
        ...attachment,
        width,
        height,
        thumbnail: {
          path: thumbnailPath,
          contentType: THUMBNAIL_CONTENT_TYPE,
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
        },
      };
    } catch (error) {
      logger.error(
        'captureDimensionsAndScreenshot:',
        'error processing image; skipping screenshot generation',
        toLogFormat(error)
      );
      return attachment;
    }
  }

  let screenshotObjectUrl;
  try {
    const screenshotBuffer = await blobToArrayBuffer(
      await makeVideoScreenshot({
        objectUrl: absolutePath,
        contentType: THUMBNAIL_CONTENT_TYPE,
        logger,
      })
    );
    screenshotObjectUrl = makeObjectUrl(
      screenshotBuffer,
      THUMBNAIL_CONTENT_TYPE
    );
    const { width, height } = await getImageDimensions({
      objectUrl: screenshotObjectUrl,
      logger,
    });
    const screenshotPath = await writeNewAttachmentData(screenshotBuffer);

    const thumbnailBuffer = await blobToArrayBuffer(
      await makeImageThumbnail({
        size: THUMBNAIL_SIZE,
        objectUrl: screenshotObjectUrl,
        contentType: THUMBNAIL_CONTENT_TYPE,
        logger,
      })
    );

    const thumbnailPath = await writeNewAttachmentData(thumbnailBuffer);

    return {
      ...attachment,
      screenshot: {
        contentType: THUMBNAIL_CONTENT_TYPE,
        path: screenshotPath,
        width,
        height,
      },
      thumbnail: {
        path: thumbnailPath,
        contentType: THUMBNAIL_CONTENT_TYPE,
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
      },
      width,
      height,
    };
  } catch (error) {
    logger.error(
      'captureDimensionsAndScreenshot: error processing video; skipping screenshot generation',
      toLogFormat(error)
    );
    return attachment;
  } finally {
    revokeObjectUrl(screenshotObjectUrl);
  }
};
