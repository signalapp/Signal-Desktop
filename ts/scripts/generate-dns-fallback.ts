// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { lookup as lookupCb } from 'dns';
import { writeFile } from 'fs/promises';
import { promisify } from 'util';
import type { ResolvedEndpoint } from 'electron';

import { isNotNil } from '../util/isNotNil';

const lookup = promisify(lookupCb);

const FALLBACK_DOMAINS = [
  'chat.signal.org',
  'storage.signal.org',
  'cdsi.signal.org',
  'cdn.signal.org',
  'cdn2.signal.org',
  'cdn3.signal.org',
  'updates2.signal.org',
  'sfu.voip.signal.org',
];

async function main() {
  const config = await Promise.all(
    FALLBACK_DOMAINS.sort().map(async domain => {
      const addresses = await lookup(domain, { all: true });

      const endpoints = addresses
        .map(({ address, family }): ResolvedEndpoint | null => {
          if (family === 4) {
            return { family: 'ipv4', address };
          }
          if (family === 6) {
            return { family: 'ipv6', address };
          }
          return null;
        })
        .filter(isNotNil)
        .sort((a, b) => {
          if (a.family < b.family) {
            return -1;
          }
          if (a.family > b.family) {
            return 1;
          }

          if (a.address < b.address) {
            return -1;
          }
          if (a.address > b.address) {
            return 1;
          }
          return 0;
        });

      return { domain, endpoints };
    })
  );

  const outPath = join(__dirname, '../../build/dns-fallback.json');

  await writeFile(outPath, `${JSON.stringify(config, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
