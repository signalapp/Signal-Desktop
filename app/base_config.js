const fs = require('fs');

const _ = require('lodash');

const ENCODING = 'utf8';

module.exports = {
  start,
};

function start(name, targetPath, options = {}) {
  const { allowMalformedOnStartup } = options;
  let cachedValue = null;

  try {
    const text = fs.readFileSync(targetPath, ENCODING);
    cachedValue = JSON.parse(text);
    console.log(`config/get: Successfully read ${name} config file`);

    if (!cachedValue) {
      console.log(
        `config/get: ${name} config value was falsy, cache is now empty object`
      );
      cachedValue = Object.create(null);
    }
  } catch (error) {
    if (!allowMalformedOnStartup && error.code !== 'ENOENT') {
      throw error;
    }

    console.log(
      `config/get: Did not find ${name} config file, cache is now empty object`
    );
    cachedValue = Object.create(null);
  }

  function get(keyPath) {
    return _.get(cachedValue, keyPath);
  }

  function set(keyPath, value) {
    _.set(cachedValue, keyPath, value);
    console.log(`config/set: Saving ${name} config to disk`);
    const text = JSON.stringify(cachedValue, null, '  ');
    fs.writeFileSync(targetPath, text, ENCODING);
  }

  function remove() {
    console.log(`config/remove: Deleting ${name} config from disk`);
    fs.unlinkSync(targetPath);
    cachedValue = Object.create(null);
  }

  return {
    set,
    get,
    remove,
  };
}
