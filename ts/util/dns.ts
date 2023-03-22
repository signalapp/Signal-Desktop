// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  lookup as nativeLookup,
  resolve4,
  resolve6,
  getServers,
  setServers,
} from 'dns';
import type { LookupOneOptions } from 'dns';

import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { strictAssert } from './assert';

const ORIGINAL_SERVERS = getServers();
const FALLBACK_SERVERS = ['1.1.1.1'];

export function lookupWithFallback(
  hostname: string,
  opts: LookupOneOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string,
    family: number
  ) => void
): void {
  // Node.js support various signatures, but we only support one.
  strictAssert(typeof opts === 'object', 'missing options');
  strictAssert(Boolean(opts.all) !== true, 'options.all is not supported');
  strictAssert(typeof callback === 'function', 'missing callback');

  nativeLookup(hostname, opts, (err, ...nativeArgs) => {
    if (!err) {
      return callback(err, ...nativeArgs);
    }

    const family = opts.family === 6 ? 6 : 4;

    log.error(
      `lookup: failed for ${hostname}, error: ${Errors.toLogFormat(err)}. ` +
        `Retrying with c-ares (IPv${family})`
    );
    const onRecords = (
      fallbackErr: NodeJS.ErrnoException | null,
      records: Array<string>
    ): void => {
      setServers(ORIGINAL_SERVERS);
      if (fallbackErr) {
        return callback(fallbackErr, '', 0);
      }

      if (!Array.isArray(records) || records.length === 0) {
        return callback(
          new Error(`No DNS records returned for: ${hostname}`),
          '',
          0
        );
      }

      const index = Math.floor(Math.random() * records.length);
      callback(null, records[index], family);
    };

    setServers(FALLBACK_SERVERS);
    if (family === 4) {
      resolve4(hostname, onRecords);
    } else {
      resolve6(hostname, onRecords);
    }
  });
}
