const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');

const { app } = require('electron').remote;

const userDataPath = app.getPath('userData');
const PATH = path.join(userDataPath, 'profileImages');
mkdirp.sync(PATH);

const hasImage = pubKey => fs.existsSync(getImagePath(pubKey));

const getImagePath = pubKey => `${PATH}/${pubKey}.png`;

const removeImage = pubKey => {
  if (hasImage(pubKey)) {
    fs.unlinkSync(getImagePath(pubKey));
  }
};

const removeImagesNotInArray = pubKeyArray => {
  fs
    .readdirSync(PATH)
    // Get all files that end with png
    .filter(file => file.includes('.png'))
    // Strip the extension
    .map(i => path.basename(i, '.png'))
    // Get any file that is not in the pubKeyArray
    .filter(i => !pubKeyArray.includes(i))
    // Remove them
    .forEach(i => removeImage(i));
};

const writePNGImage = (base64String, pubKey) => {
  const imagePath = getImagePath(pubKey);
  fs.writeFileSync(imagePath, base64String, 'base64');
  return imagePath;
};

module.exports = {
  writePNGImage,
  getImagePath,
  hasImage,
  removeImage,
  removeImagesNotInArray,
};
