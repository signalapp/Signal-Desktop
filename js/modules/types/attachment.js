/* eslint-env browser */

const MIME = require('./mime');
const { arrayBufferToBlob, blobToArrayBuffer, dataURLToBlob } = require('blob-util');
const { autoOrientImage } = require('../auto_orient_image');

// Increment this everytime we change how attachments are processed. This allows us to
// retroactively update existing attachments. As we add more processing steps, we could
// design a pipeline that does this incrementally, e.g. from version 0 (unknown) -> 1,
// 1 --> 2, etc., similar to how we do database migrations:
const CURRENT_PROCESS_VERSION = 1;

// // Fields
// {
//   id: string
//   contentType: MIMEType
//   key: ArrayBuffer
//   size: integer
//   thumbnail: ArrayBuffer
//   digest: ArrayBuffer
//   fileName: string
//   flags: null
//   data: ArrayBuffer
// }

// Middleware
// type ProcessingStep = Attachment -> Promise Attachment

// ProcessingStep -> ProcessVersion -> ProcessingStep
const setProcessVersion = (next, processVersion) => async (attachment) => {
  const isAlreadyProcessed = attachment.processVersion >= processVersion;
  if (isAlreadyProcessed) {
    return attachment;
  }

  let processedAttachment;
  try {
    processedAttachment = await next(attachment);
  } catch (error) {
    console.error('Attachment.setProcessVersion: error:', error);
    processedAttachment = null;
  }

  const hasSuccessfullyProcessed = processedAttachment !== null;
  if (!hasSuccessfullyProcessed) {
    return attachment;
  }

  // TODO: Enable `...` object spread operator syntax:
  return Object.assign(
    {},
    processedAttachment,
    { processVersion }
  );
};

// Processing steps
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
// ProcessingStep
exports.process = setProcessVersion(autoOrientJPEG, CURRENT_PROCESS_VERSION);
