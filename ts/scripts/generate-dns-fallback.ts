// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { resolve4 as resolve4Cb, resolve6 as resolve6Cb } from 'dns';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

import { isNotNil } from '../util/isNotNil';

const resolve4 = promisify(resolve4Cb);
const resolve6 = promisify(resolve6Cb);

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
      const ipv4endpoints = (await resolve4(domain)).map(a => ({
        family: 'ipv4',
        address: a,
      }));

      const ipv6endpoints = (await resolve6(domain)).map(a => ({
        family: 'ipv6',
        address: a,
      }));

      const endpoints = [...ipv4endpoints, ...ipv6endpoints]
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
