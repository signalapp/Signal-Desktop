const loadImage = require('blueimp-load-image');

const DEFAULT_JPEG_QUALITY = 0.85;

// File | Blob | URLString -> LoadImageOptions -> Promise<DataURLString>
//
// Documentation for `options` (`LoadImageOptions`):
// https://github.com/blueimp/JavaScript-Load-Image/tree/v2.18.0#options
exports.autoOrientImage = (fileOrBlobOrURL, options = {}) => {
  const optionsWithDefaults = Object.assign(
    {
      type: 'image/jpeg',
      quality: DEFAULT_JPEG_QUALITY,
    },
    options,
    {
      canvas: true,
      orientation: true,
    }
  );

  return new Promise((resolve, reject) => {
    loadImage(
      fileOrBlobOrURL,
      canvasOrError => {
        if (canvasOrError.type === 'error') {
          const error = new Error('autoOrientImage: Failed to process image');
          error.cause = canvasOrError;
          reject(error);
          return;
        }

        const canvas = canvasOrError;
        const dataURL = canvas.toDataURL(
          optionsWithDefaults.type,
          optionsWithDefaults.quality
        );

        resolve(dataURL);
      },
      optionsWithDefaults
    );
  });
};
