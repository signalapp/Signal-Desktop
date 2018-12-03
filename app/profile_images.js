const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const Identicon = require('identicon.js');
const sha224 = require('js-sha512').sha512_224;

const { app } = require('electron').remote;

const userDataPath = app.getPath('userData');
const PATH = path.join(userDataPath, 'profileImages');
mkdirp.sync(PATH);

const hasImage = pubKey => fs.existsSync(getImagePath(pubKey));

const getImagePath = pubKey => `${PATH}/${pubKey}.png`;
const getOrCreateImagePath = pubKey => {
  // If the image doesn't exist then create it
  if (!hasImage(pubKey))
    return generateImage(pubKey);

  return getImagePath(pubKey);
};

const removeImage = pubKey => {
  if (hasImage(pubKey)) {
    fs.unlinkSync(getImagePath(pubKey));
  }
}

const removeImagesNotInArray = pubKeyArray => {
  fs.readdirSync(PATH)
    // Get all files that end with png
    .filter(file => file.includes('.png'))
    // Strip the extension
    .map(i => path.basename(i, '.png'))
    // Get any file that is not in the pubKeyArray
    .filter(i => !pubKeyArray.includes(i))
    // Remove them
    .forEach(i => removeImage(i));
}

const generateImage = pubKey => {
  const imagePath = getImagePath(pubKey);

  /*
    We hash the pubKey and then pass that into Identicon.
    This is to avoid getting the same image
      if 2 public keys start with the same 15 characters.
  */
  const png = new Identicon(sha224(pubKey), {
    margin: 0.2,
    background: [0,0,0,0],
  }).toString();
  fs.writeFileSync(imagePath, png, 'base64');
  return imagePath
}

module.exports = {
  generateImage,
  getOrCreateImagePath,
  getImagePath,
  hasImage,
  removeImage,
  removeImagesNotInArray,
};
