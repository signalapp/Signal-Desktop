// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LookupOneOptions, LookupAllOptions, LookupAddress } from 'dns';
import { lookup as nodeLookup } from 'dns';
import { ipcRenderer, net } from 'electron';
import type { ResolvedHost } from 'electron';

import { strictAssert } from './assert';
import { drop } from './drop';

const HOST_ALLOWLIST = new Set([
  // Production
  'chat.signal.org',
  'storage.signal.org',
  'cdsi.signal.org',
  'cdn.signal.org',
  'cdn2.signal.org',
  'create.signal.art',

  // Staging
  'chat.staging.signal.org',
  'storage-staging.signal.org',
  'cdsi.staging.signal.org',
  'cdn-staging.signal.org',
  'cdn2-staging.signal.org',
  'create.staging.signal.art',

  // Common
  'updates2.signal.org',
  'sfu.voip.signal.org',
]);

function lookupAll(
  hostname: string,
  opts: LookupOneOptions | LookupAllOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    addresses: string | Array<LookupAddress>,
    family?: number
  ) => void
): void {
  if (!HOST_ALLOWLIST.has(hostname)) {
    nodeLookup(hostname, opts, callback);
    return;
  }

  // Node.js support various signatures, but we only support one.
  strictAssert(typeof opts === 'object', 'missing options');
  strictAssert(typeof callback === 'function', 'missing callback');

  async function run() {
    let result: ResolvedHost;

    try {
      let queryType: 'A' | 'AAAA' | undefined;
      if (opts.family === 4) {
        queryType = 'A';
      } else if (opts.family === 6) {
        queryType = 'AAAA';
      }

      if (net) {
        // Main process
        result = await net.resolveHost(hostname, {
          queryType,
        });
      } else {
        // Renderer
        result = await ipcRenderer.invoke(
          'net.resolveHost',
          hostname,
          queryType
        );
      }
      const addresses = result.endpoints.map(({ address, family }) => {
        let numericFamily = -1;
        if (family === 'ipv4') {
          numericFamily = 4;
        } else if (family === 'ipv6') {
          numericFamily = 6;
        }
        return {
          address,
          family: numericFamily,
        };
      });

      if (!opts.all) {
        const random = addresses.at(
          Math.floor(Math.random() * addresses.length)
        );
        if (random === undefined) {
          callback(
            new Error(`Hostname: ${hostname} cannot be resolved`),
            '',
            -1
          );
          return;
        }
        callback(null, random.address, random.family);
        return;
      }

      callback(null, addresses);
    } catch (error) {
      callback(error, []);
    }
  }

  drop(run());
}

// Note: `nodeLookup` has a complicated type due to compatibility requirements.
export const electronLookup = lookupAll as typeof nodeLookup;
