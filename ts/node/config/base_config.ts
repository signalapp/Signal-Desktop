import { readFileSync, unlinkSync, writeFileSync } from 'fs';

const ENCODING = 'utf8';

type ValueType = number | string | boolean | null | object;

export function start(
  name: string,
  targetPath: string,
  options: {
    allowMalformedOnStartup?: boolean;
  } = {}
) {
  const { allowMalformedOnStartup } = options;
  let cachedValue: Record<string, ValueType> = {};

  try {
    const text = readFileSync(targetPath, ENCODING);
    cachedValue = JSON.parse(text);
    console.log(`config/get: Successfully read ${name} config file`);

    if (!cachedValue) {
      console.log(`config/get: ${name} config value was falsy, cache is now empty object`);
      cachedValue = Object.create(null);
    }
  } catch (error) {
    if (!allowMalformedOnStartup && error.code !== 'ENOENT') {
      throw error;
    }

    console.log(`config/get: Did not find ${name} config file, cache is now empty object`);
    cachedValue = Object.create(null);
  }

  function get(keyPath: string) {
    return cachedValue[keyPath];
  }

  function set(keyPath: string, value: ValueType) {
    cachedValue[keyPath] = value;
    console.log(`config/set: Saving ${name} config to disk`);
    const text = JSON.stringify(cachedValue, null, '  ');
    writeFileSync(targetPath, text, ENCODING);
    console.log(`config/set: Saved ${name} config to disk`);
  }

  function remove() {
    console.log(`config/remove: Deleting ${name} config from disk`);
    unlinkSync(targetPath);
    cachedValue = Object.create(null);
  }

  return {
    set,
    get,
    remove,
  };
}
