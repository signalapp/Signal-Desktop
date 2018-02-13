/* jshint ignore:start */

const dataURLToBlob = require('blueimp-canvas-to-blob');

// // Fields
// {
//   "id": "7494241695219027913",
//   "contentType": "image/jpeg",
//   "key": {},
//   "size": 352727,
//   "thumbnail": null,
//   "digest": {},
//   "fileName": "Landscape_6.jpg",
//   "flags": null,
//   "data": {}
// }

const isJPEG = mimeType =>
  mimeType === 'image/jpeg' || mimeType === 'image/jpg';

// Data type conversion
const blobToArrayBuffer = blob => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = event =>
        resolve(event.target.result);

    fileReader.readAsArrayBuffer(blob);
  });
};

const arrayBufferToBlob = (arrayBuffer, mimeType) =>
  new Blob([arrayBuffer], {type: mimeType});

// Processing steps:
const withLastNormalizedDate = attachment => Object.assign(
  {},
  attachment,
  {lastNormalized: new Date().toISOString()},
);

const autoOrientJPEGs = async attachment => {
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

