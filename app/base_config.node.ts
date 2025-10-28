// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync, unlinkSync } from 'node:fs';
import { sync as writeFileSync } from 'write-file-atomic';

import lodash from 'lodash';
import lodashFp from 'lodash/fp.js';
import { strictAssert } from '../ts/util/assert.std.js';
import { createLogger } from '../ts/logging/log.std.js';

const { set } = lodashFp;

const { get } = lodash;

const log = createLogger('base_config');

const ENCODING = 'utf8';

type InternalConfigType = Record<string, unknown>;

export type ConfigType = {
  set: (keyPath: string, value: unknown) => void;
  get: (keyPath: string) => unknown;
  remove: () => void;

  // Test-only
  _getCachedValue: () => InternalConfigType | undefined;
};

export function start({
  name,
  targetPath,
  throwOnFilesystemErrors,
}: Readonly<{
  name: string;
  targetPath: string;
  throwOnFilesystemErrors: boolean;
}>): ConfigType {
  let cachedValue: InternalConfigType = Object.create(null);
  let incomingJson: string | undefined;

  try {
    incomingJson = readFileSync(targetPath, ENCODING);
    cachedValue = incomingJson ? JSON.parse(incomingJson) : undefined;
    log.info(`config/get: Successfully read ${name} config file`);

    if (!cachedValue) {
      log.info(
        `config/start: ${name} config value was falsy, cache is now empty object`
      );
      cachedValue = Object.create(null);
    }
  } catch (error) {
    if (throwOnFilesystemErrors && error.code !== 'ENOENT') {
      throw error;
    }

    if (incomingJson) {
      log.info(
        `config/start: ${name} config file was malformed, starting afresh`
      );
    } else {
      log.info(
        `config/start: Did not find ${name} config file (or it was empty), cache is now empty object`
      );
    }
    cachedValue = Object.create(null);
  }

  function ourGet(keyPath: string): unknown {
    return get(cachedValue, keyPath);
  }

  function ourSet(keyPath: string, value: unknown): void {
    const newCachedValue = set(keyPath, value, cachedValue);

    log.info(`config/set: Saving ${name} config to disk`);

    if (!throwOnFilesystemErrors) {
      cachedValue = newCachedValue;
    }
    const outgoingJson = JSON.stringify(newCachedValue, null, '  ');
    try {
      writeFileSync(targetPath, outgoingJson, ENCODING);
      log.info(`config/set: Saved ${name} config to disk`);
      cachedValue = newCachedValue;
    } catch (err: unknown) {
      if (throwOnFilesystemErrors) {
        throw err;
      } else {
        log.warn(
          `config/set: Failed to save ${name} config to disk; only updating in-memory data`
        );
      }
    }
  }

  function remove(): void {
    log.info(`config/remove: Deleting ${name} config from disk`);
    try {
      unlinkSync(targetPath);
      log.info(`config/remove: Deleted ${name} config from disk`);
    } catch (err: unknown) {
      const errCode: unknown = get(err, 'code');
      if (throwOnFilesystemErrors) {
        strictAssert(errCode === 'ENOENT', 'Expected deletion of no file');
        log.info(`config/remove: No ${name} config on disk, did nothing`);
      } else {
        log.warn(
          `config/remove: Got ${String(
            errCode
          )} when removing ${name} config from disk`
        );
      }
    }
    cachedValue = Object.create(null);
  }

  return {
    set: ourSet,
    get: ourGet,
    remove,
    _getCachedValue: () => cachedValue,
  };
}
