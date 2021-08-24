// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync, writeFileSync, unlinkSync } from 'fs';

import { get, set } from 'lodash';

const ENCODING = 'utf8';

type ConfigType = Record<string, unknown>;

export function start(
  name: string,
  targetPath: string,
  options?: { allowMalformedOnStartup?: boolean }
): {
  set: (keyPath: string, value: unknown) => void;
  get: (keyPath: string) => unknown;
  remove: () => void;
} {
  let cachedValue: ConfigType | undefined;

  try {
    const text = readFileSync(targetPath, ENCODING);
    cachedValue = JSON.parse(text);
    console.log(`config/get: Successfully read ${name} config file`);

    if (!cachedValue) {
      console.log(
        `config/get: ${name} config value was falsy, cache is now empty object`
      );
      cachedValue = Object.create(null);
    }
  } catch (error) {
    if (!options?.allowMalformedOnStartup && error.code !== 'ENOENT') {
      throw error;
    }

    console.log(
      `config/get: Did not find ${name} config file, cache is now empty object`
    );
    cachedValue = Object.create(null);
  }

  function ourGet(keyPath: string): unknown {
    return get(cachedValue, keyPath);
  }

  function ourSet(keyPath: string, value: unknown): void {
    if (!cachedValue) {
      throw new Error('ourSet: no cachedValue!');
    }

    set(cachedValue, keyPath, value);
    console.log(`config/set: Saving ${name} config to disk`);
    const text = JSON.stringify(cachedValue, null, '  ');
    writeFileSync(targetPath, text, ENCODING);
  }

  function remove(): void {
    console.log(`config/remove: Deleting ${name} config from disk`);
    unlinkSync(targetPath);
    cachedValue = Object.create(null);
  }

  return {
    set: ourSet,
    get: ourGet,
    remove,
  };
}
