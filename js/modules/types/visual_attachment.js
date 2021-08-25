// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global document, URL, Blob */

const loadImage = require('blueimp-load-image');
const { blobToArrayBuffer } = require('blob-util');
const { toLogFormat } = require('../../../ts/types/errors');
const {
  arrayBufferToObjectURL,
} = require('../../../ts/util/arrayBufferToObjectURL');
const { canvasToBlob } = require('../../../ts/util/canvasToBlob');

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

    image.addEventListener('load', async () => {
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

      try {
        const blob = await canvasToBlob(canvas, contentType);
        resolve(blob);
      } catch (err) {
        reject(err);
      }
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

    function seek() {
      video.currentTime = 1.0;
    }

    async function capture() {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas
        .getContext('2d')
        .drawImage(video, 0, 0, canvas.width, canvas.height);

      video.addEventListener('loadeddata', seek);
      video.removeEventListener('seeked', capture);

      try {
        const image = canvasToBlob(canvas, contentType);
        resolve(image);
      } catch (err) {
        reject(err);
      }
    }

    video.addEventListener('loadeddata', seek);
    video.addEventListener('seeked', capture);

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
