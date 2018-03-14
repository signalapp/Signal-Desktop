const isFunction = require('lodash/isFunction');
const isNumber = require('lodash/isNumber');
const isString = require('lodash/isString');
const isUndefined = require('lodash/isUndefined');

const MIME = require('./mime');
const { arrayBufferToBlob, blobToArrayBuffer, dataURLToBlob } = require('blob-util');
const { autoOrientImage } = require('../auto_orient_image');

// Increment this version number every time we change how attachments are upgraded. This
// will allow us to retroactively upgrade existing attachments. As we add more upgrade
// steps, we could design a pipeline that does this incrementally, e.g. from
// version 0 / unknown -> 1, 1 --> 2, etc., similar to how we do database migrations:
exports.CURRENT_SCHEMA_VERSION = 2;

// Schema version history
//
// Version 1
//   - Auto-orient JPEG attachments using EXIF `Orientation` data
//   - Add `schemaVersion` property
// Version 2
//   - Sanitize Unicode order override characters

// // Incoming message attachment fields
// {
//   id: string
//   contentType: MIMEType
//   data: ArrayBuffer
//   digest: ArrayBuffer
//   fileName: string
//   flags: null
//   key: ArrayBuffer
//   size: integer
//   thumbnail: ArrayBuffer
//   schemaVersion: integer
// }

// // Outgoing message attachment fields
// {
//   contentType: MIMEType
//   data: ArrayBuffer
//   fileName: string
//   size: integer
//   schemaVersion: integer
// }

// Returns true if `rawAttachment` is a valid attachment based on our (limited)
// criteria. Over time, we can expand this definition to become more narrow:
exports.isValid = (rawAttachment) => {
  // NOTE: We cannot use `_.isPlainObject` because `rawAttachment` is
  // deserialized by protobuf:
  if (!rawAttachment) {
    return false;
  }

  return isString(rawAttachment.contentType) &&
    isString(rawAttachment.fileName);
};

// Middleware
// type UpgradeStep = Attachment -> Promise Attachment

// SchemaVersion -> UpgradeStep -> UpgradeStep
exports.withSchemaVersion = (schemaVersion, upgrade) => {
  if (!isNumber(schemaVersion)) {
    throw new TypeError('`schemaVersion` must be a number');
  }
  if (!isFunction(upgrade)) {
    throw new TypeError('`upgrade` must be a function');
  }

  return async (attachment) => {
    if (!exports.isValid(attachment)) {
      console.log('Attachment.withSchemaVersion: Invalid input attachment:', attachment);
      return attachment;
    }

    const isAlreadyUpgraded = attachment.schemaVersion >= schemaVersion;
    if (isAlreadyUpgraded) {
      return attachment;
    }

    const expectedVersion = schemaVersion - 1;
    const isUnversioned = isUndefined(attachment.schemaVersion);
    const hasExpectedVersion = isUnversioned ||
      attachment.schemaVersion === expectedVersion;
    if (!hasExpectedVersion) {
      console.log(
        'WARNING: Attachment.withSchemaVersion: Unexpected version:' +
        ` Expected attachment to have version ${expectedVersion},` +
        ` but got ${attachment.schemaVersion}.`,
        attachment
      );
      return attachment;
    }

    let upgradedAttachment;
    try {
      upgradedAttachment = await upgrade(attachment);
    } catch (error) {
      console.log(
        'Attachment.withSchemaVersion: error:',
        error && error.stack ? error.stack : error
      );
      return attachment;
    }

    if (!exports.isValid(upgradedAttachment)) {
      console.log(
        'Attachment.withSchemaVersion: Invalid upgraded attachment:',
        upgradedAttachment
      );
      return attachment;
    }

    return Object.assign(
      {},
      upgradedAttachment,
      { schemaVersion }
    );
  };
};

// Upgrade steps
const autoOrientJPEG = async (attachment) => {
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
  if (!isString(attachment.fileName)) {
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

// Public API
const toVersion1 = exports.withSchemaVersion(1, autoOrientJPEG);
const toVersion2 = exports.withSchemaVersion(2, exports.replaceUnicodeOrderOverrides);

// UpgradeStep
exports.upgradeSchema = async attachment =>
  toVersion2(await toVersion1(attachment));
