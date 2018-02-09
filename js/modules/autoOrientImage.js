const loadImage = require('blueimp-load-image');

// File | Blob | URLString -> LoadImageOptions -> Promise<DataURLString>
//
// Documentation for `options`:
// https://github.com/blueimp/JavaScript-Load-Image/tree/v2.18.0#options
exports.autoOrientImage = (fileOrBlobOrURL, options) => {
  const optionsWithAutoOrient = Object.assign(
    {},
    options, {
      canvas: true,
      orientation: true,
    }
  );

  return new Promise((resolve, reject) => {
    loadImage(fileOrBlobOrURL, canvasOrError => {
      if (canvasOrError.type === 'error') {
        const error = canvasOrError;
        reject(error);
        return;
      }

      const canvas = canvasOrError;
      const dataURL = canvas.toDataURL();
      resolve(dataURL);
    }, optionsWithAutoOrient);
  });
};
