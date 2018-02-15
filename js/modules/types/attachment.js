const MIME = require('./mime');
const { arrayBufferToBlob, blobToArrayBuffer, dataURLToBlob } = require('blob-util');
const { autoOrientImage } = require('../auto_orient_image');

// Increment this everytime we change how attachments are upgraded. This allows us to
// retroactively upgrade existing attachments. As we add more upgrade steps, we could
// design a pipeline that does this incrementally, e.g. from version 0 (unknown) -> 1,
// 1 --> 2, etc., similar to how we do database migrations:
const CURRENT_PROCESS_VERSION = 1;

// Schema version history
//
// Version 1
//   - Auto-orient JPEG attachments using EXIF `Orientation` data
//   - Add `schemaVersion` property

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

// Middleware
// type UpgradeStep = Attachment -> Promise Attachment

// UpgradeStep -> SchemaVersion -> UpgradeStep
const setSchemaVersion = (next, schemaVersion) => async (attachment) => {
  const isAlreadyUpgraded = attachment.schemaVersion >= schemaVersion;
  if (isAlreadyUpgraded) {
    return attachment;
  }

  let upgradedAttachment;
  try {
    upgradedAttachment = await next(attachment);
  } catch (error) {
    console.error('Attachment.setSchemaVersion: error:', error);
    upgradedAttachment = null;
  }

  const hasSuccessfullyUpgraded = upgradedAttachment !== null;
  if (!hasSuccessfullyUpgraded) {
    return attachment;
  }

  return Object.assign(
    {},
    upgradedAttachment,
    { schemaVersion }
  );
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

// Public API
// UpgradeStep
exports.upgradeSchema = setSchemaVersion(autoOrientJPEG, CURRENT_PROCESS_VERSION);
