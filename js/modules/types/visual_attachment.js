/* eslint-disable more/no-then */
/* global document, URL, Blob */

const loadImage = require('blueimp-load-image');
const { toLogFormat } = require('./errors');
const toArrayBuffer = require('to-arraybuffer');

const dataURLToBlobSync = require('blueimp-canvas-to-blob');
const fse = require('fs-extra');

const { blobToArrayBuffer } = require('blob-util');

const AttachmentTS = require('../../../ts/types/Attachment');
const DecryptedAttachmentsManager = require('../../../ts/session/crypto/DecryptedAttachmentsManager');

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
    //FIXME image/jpeg is hard coded
    DecryptedAttachmentsManager.getDecryptedAttachmentUrl(
      objectUrl,
      'image/jpg'
    ).then(decryptedUrl => {
      image.src = decryptedUrl;
    });
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

    DecryptedAttachmentsManager.getDecryptedAttachmentUrl(
      objectUrl,
      contentType
    ).then(decryptedUrl => {
      image.src = decryptedUrl;
    });
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
      video.pause();
      video.currentTime = 0;
      resolve(image);
    }

    video.addEventListener('canplay', capture);
    video.addEventListener('error', error => {
      logger.error('makeVideoScreenshot error', toLogFormat(error));
      reject(error);
    });

    DecryptedAttachmentsManager.getDecryptedAttachmentUrl(
      objectUrl,
      'image/jpg'
    ).then(decryptedUrl => {
      video.src = decryptedUrl;
      video.muted = true;
      // for some reason, this is to be started, otherwise the generated thumbnail will be empty
      video.play();
    });
  });

exports.makeObjectUrl = (data, contentType) => {
  const blob = new Blob([data], {
    type: contentType,
  });

  return URL.createObjectURL(blob);
};

exports.revokeObjectUrl = objectUrl => {
  URL.revokeObjectURL(objectUrl);
};
