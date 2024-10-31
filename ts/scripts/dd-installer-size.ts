// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { name as NAME, version as VERSION } from '../../package.json';

const SUPPORT_CONFIG = new Set([
  'linux',
  'windows',
  'macos-arm64',
  'macos-x64',
  'macos-universal',
]);

const RELEASE_DIR = join(__dirname, '..', '..', 'release');

async function main(): Promise<void> {
  const config = process.argv[2];
  if (!SUPPORT_CONFIG.has(config)) {
    throw new Error(`Invalid argument: ${config}`);
  }

  const { DD_API_KEY } = process.env;
  if (DD_API_KEY == null) {
    throw new Error('Missing DD_API_KEY env variable');
  }

  let fileName: string;
  let platform: string;
  let arch: string;
  if (config === 'linux') {
    fileName = `${NAME}_${VERSION}_amd64.deb`;
    platform = 'linux';
    arch = 'x64';
  } else if (config === 'windows') {
    fileName = `${NAME}-win-x64-${VERSION}.exe`;
    platform = 'windows';
    arch = 'x64';
  } else if (config === 'macos-arm64') {
    fileName = `${NAME}-mac-arm64-${VERSION}.dmg`;
    platform = 'macos';
    arch = 'arm64';
  } else if (config === 'macos-x64') {
    fileName = `${NAME}-mac-x64-${VERSION}.dmg`;
    platform = 'macos';
    arch = 'x64';
  } else if (config === 'macos-universal') {
    fileName = `${NAME}-mac-universal-${VERSION}.dmg`;
    platform = 'macos';
    arch = 'universal';
  } else {
    throw new Error(`Unsupported config: ${config}`);
  }

  const filePath = join(RELEASE_DIR, fileName);
  const { size } = await stat(filePath);

  const res = await fetch('https://api.datadoghq.com/api/v2/series', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'DD-API-KEY': DD_API_KEY,
    },
    body: JSON.stringify({
      series: [
        {
          metric: 'desktop.ci.installerSize',
          type: 0,
          points: [
            {
              timestamp: Math.floor(Date.now() / 1000),
              value: size,
            },
          ],
          tags: [
            `hash:${process.env.GITHUB_SHA ?? ''}`,
            `platform:${platform}`,
            `arch:${arch}`,
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to submit metrics, status: ${res.status}, ` +
        `body: ${await res.text()}`
    );
  }

  console.log(`Submitted: ${size}`);
}

main().catch(err => {
  console.error('Failed', err);
  process.exit(1);
});
