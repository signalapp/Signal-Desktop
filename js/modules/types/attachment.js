const is = require('@sindresorhus/is');

const MIME = require('../../../ts/types/MIME');
const { arrayBufferToBlob, blobToArrayBuffer, dataURLToBlob } = require('blob-util');
const { autoOrientImage } = require('../auto_orient_image');
const { migrateDataToFileSystem } = require('./attachment/migrate_data_to_file_system');

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
exports.isValid = (rawAttachment) => {
  // NOTE: We cannot use `_.isPlainObject` because `rawAttachment` is
  // deserialized by protobuf:
  if (!rawAttachment) {
    return false;
  }

  return true;
};

// Upgrade steps
exports.autoOrientJPEG = async (attachment) => {
  if (!MIME.isJPEG(attachment.contentType)) {
    return attachment;
  }

  const dataBlob = await arrayBufferToBlob(attachment.data, attachment.contentType);
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
exports._replaceUnicodeOrderOverridesSync = (attachment) => {
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

exports.removeSchemaVersion = (attachment) => {
  if (!exports.isValid(attachment)) {
    console.log('Attachment.removeSchemaVersion: Invalid input attachment:', attachment);
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
exports.loadData = (readAttachmentData) => {
  if (!is.function(readAttachmentData)) {
    throw new TypeError("'readAttachmentData' must be a function");
  }

  return async (attachment) => {
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
exports.deleteData = (deleteAttachmentData) => {
  if (!is.function(deleteAttachmentData)) {
    throw new TypeError("'deleteAttachmentData' must be a function");
  }

  return async (attachment) => {
    if (!exports.isValid(attachment)) {
      throw new TypeError("'attachment' is not valid");
    }

    const hasDataInMemory = exports.hasData(attachment);
    if (hasDataInMemory) {
      return;
    }

    if (!is.string(attachment.path)) {
      throw new TypeError("'attachment.path' is required");
    }

    await deleteAttachmentData(attachment.path);
  };
};
