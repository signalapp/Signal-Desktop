const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const jdenticon = require('jdenticon');

// Icon config
jdenticon.config = {
  lightness: {
      color: [0.40, 0.80],
      grayscale: [0.30, 0.90],
  },
  saturation: {
      color: 0.50,
      grayscale: 0.00,
  },
  backColor: '#86444400',
};

const { app } = require('electron').remote;

const userDataPath = app.getPath('userData');
const PATH = path.join(userDataPath, 'profileImages');
mkdirp.sync(PATH);

function hashCode(s) {
  let h = 0;
  for(let i = 0; i < s.length; i += 1)
      h = Math.imul(31, h) + s.charCodeAt(i) | 0;

  return h;
}

const hasImage = pubKey => fs.existsSync(getImagePath(pubKey));

const getImagePath = pubKey => `${PATH}/${pubKey}.png`;
const getOrCreateImagePath = pubKey => {
  const imagePath = getImagePath(pubKey);

  // If the image doesn't exist then create it
  if (!hasImage(pubKey)) {
    /*
      We hash the pubKey and then pass that into jdenticon
      This is because if we pass pubKey directly,
      jdenticon trims the string and then generates a hash
      meaning public keys with the same characters at the beginning
      will get the same images
    */
    const png = jdenticon.toPng(hashCode(pubKey), 50, 0.12);
    fs.writeFileSync(imagePath, png);
  }

  return imagePath;
};

const removeImage = pubKey => {
  if (hasImage(pubKey)) {
    fs.unlinkSync(getImagePath(pubKey));
  }
}

module.exports = {
  getOrCreateImagePath,
  getImagePath,
  hasImage,
  removeImage,
  hashCode,
};
