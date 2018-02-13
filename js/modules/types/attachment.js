/* jshint ignore:start */

const dataURLToBlob = require('blueimp-canvas-to-blob');

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

const isJPEG = mimeType =>
  mimeType === 'image/jpeg' || mimeType === 'image/jpg';

// Data type conversion
const blobToArrayBuffer = blob =>
  new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = event =>
      resolve(event.target.result);

    fileReader.onerror = (event) => {
      const error = new Error('blobToArrayBuffer: Failed to convert blob');
      error.cause = event;
      reject(error);
    };

    fileReader.readAsArrayBuffer(blob);
  });

const arrayBufferToBlob = (arrayBuffer, mimeType) =>
  new Blob([arrayBuffer], { type: mimeType });

// Processing steps:
const withLastNormalizedDate = attachment => Object.assign(
  {},
  attachment,
  {lastNormalized: new Date().toISOString()},
);

const autoOrientJPEGs = async (attachment) => {
  if (!isJPEG(attachment.contentType)) {
    return attachment;
  }

  const dataBlob = arrayBufferToBlob(attachment.data, attachment.contentType);
  const newDataBlob = dataURLToBlob(await autoOrientImage(dataBlob));
  const newDataArrayBuffer = await blobToArrayBuffer(newDataBlob);
  const newAttachment = Object.assign({}, attachment, {
    data: newDataArrayBuffer,
    size: newDataArrayBuffer.byteLength,
    lastNormalized: new Date().toISOString(),
  });

  // `digest` is no longer valid for auto-oriented image data, so we discard it:
  delete newAttachment.digest;

  return newAttachment;
};

// Public API

// Attachment -> Promise<Attachment>
exports.normalize = async attachment =>
  withLastNormalizedDate(await autoOrientJPEGs(attachment));

