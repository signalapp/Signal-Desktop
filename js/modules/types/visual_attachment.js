/* global document, URL, Blob */

const loadImage = require('blueimp-load-image');
const { toLogFormat } = require('./errors');
const dataURLToBlobSync = require('blueimp-canvas-to-blob');
const { blobToArrayBuffer } = require('blob-util');
const {
  arrayBufferToObjectURL,
} = require('../../../ts/util/arrayBufferToObjectURL');

exports.blobToArrayBuffer = blobToArrayBuffer;

exports.getImageDimensions = ({ objectUrl, logger }) =>
  new Promise((resolve, reject) => {
    const image = document.createElement('img');

    image.addEventListener('load', () => {
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    });
    image.addEventListener('error', error => {
      logger.error('getImageDimensions error', toLogFormat(error));
      reject(error);
    });

    image.src = objectUrl;
  });

exports.makeImageThumbnail = ({
  size,
  objectUrl,
  contentType = 'image/png',
  logger,
}) =>
  new Promise((resolve, reject) => {
    const image = document.createElement('img');

    image.addEventListener('load', () => {
      // using components/blueimp-load-image

      // first, make the correct size
      let canvas = loadImage.scale(image, {
        canvas: true,
        cover: true,
        maxWidth: size,
        maxHeight: size,
        minWidth: size,
        minHeight: size,
      });

      // then crop
      canvas = loadImage.scale(canvas, {
        canvas: true,
        crop: true,
        maxWidth: size,
        maxHeight: size,
        minWidth: size,
        minHeight: size,
      });

      const blob = dataURLToBlobSync(canvas.toDataURL(contentType));

      resolve(blob);
    });

    image.addEventListener('error', error => {
      logger.error('makeImageThumbnail error', toLogFormat(error));
      reject(error);
    });

    image.src = objectUrl;
  });

exports.makeVideoScreenshot = ({
  objectUrl,
  contentType = 'image/png',
  logger,
}) =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');

    function capture() {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas
        .getContext('2d')
        .drawImage(video, 0, 0, canvas.width, canvas.height);

      const image = dataURLToBlobSync(canvas.toDataURL(contentType));

      video.removeEventListener('canplay', capture);

      resolve(image);
    }

    video.addEventListener('canplay', capture);
    video.addEventListener('error', error => {
      logger.error('makeVideoScreenshot error', toLogFormat(error));
      reject(error);
    });

    video.src = objectUrl;
  });

exports.makeVideoThumbnail = async ({
  size,
  videoObjectUrl,
  logger,
  contentType,
}) => {
  let screenshotObjectUrl;
  try {
    const blob = await exports.makeVideoScreenshot({
      objectUrl: videoObjectUrl,
      contentType,
      logger,
    });
    const data = await blobToArrayBuffer(blob);
    screenshotObjectUrl = arrayBufferToObjectURL({
      data,
      type: contentType,
    });

    // We need to wait for this, otherwise the finally below will run first
    const resultBlob = await exports.makeImageThumbnail({
      size,
      objectUrl: screenshotObjectUrl,
      contentType,
      logger,
    });

    return resultBlob;
  } finally {
    exports.revokeObjectUrl(screenshotObjectUrl);
  }
};

exports.makeObjectUrl = (data, contentType) => {
  const blob = new Blob([data], {
    type: contentType,
  });

  return URL.createObjectURL(blob);
};

exports.revokeObjectUrl = objectUrl => {
  URL.revokeObjectURL(objectUrl);
};
