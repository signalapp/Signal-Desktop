const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { app } = require('electron');

const ENCODING = 'utf8';
const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'key.txt');

module.exports = {
  get,
  set,
  initialize,
  remove,
};

function get() {
  try {
    const key = fs.readFileSync(targetPath, ENCODING);
    console.log('key/get: Successfully read key file');
    return key;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('key/get: Could not find key file, returning null');
      return null;
    }

    throw error;
  }
}

function set(key) {
  console.log('key/set: Saving key to disk');
  fs.writeFileSync(targetPath, key, ENCODING);
}

function remove() {
  console.log('key/remove: Deleting key from disk');
  fs.unlinkSync(targetPath);
}

function initialize({ userConfig }) {
  const keyFromConfig = userConfig.get('key');
  const keyFromStore = get();

  let key = keyFromStore || keyFromConfig;
  if (!key) {
    console.log(
      'key/initialize: Generating new encryption key, since we did not find it on disk'
    );
    // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
    key = crypto.randomBytes(32).toString('hex');
    set(key);
  } else if (keyFromConfig) {
    set(key);
    console.log('key/initialize: Removing key from config.json');
    userConfig.delete('key');
  }

  return key;
}
