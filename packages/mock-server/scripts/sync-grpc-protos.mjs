// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchJson, fetchText } from './utils/http.mjs';
import packageJson from '../package.json' with { type: 'json' };

const REPO = 'signalapp/libsignal';
const PROTO_DIR = 'rust/net/grpc/proto';
const TAG = `v${packageJson.dependencies['@signalapp/libsignal-client']}`;

const PACKAGE_ROOT = join(import.meta.dirname, '..');
const DEST_DIR = join(PACKAGE_ROOT, 'protos/server');

/** @type {Array<{ name: string }>} */
const chatFiles = await fetchJson(
  `https://api.github.com/repos/${REPO}/contents/${PROTO_DIR}/org/signal/chat?ref=${TAG}`,
);

const paths = [
  'TextSecure.proto',
  'google/rpc/status.proto',
  'google/rpc/error_details.proto',
  ...chatFiles
    .map((file) => `org/signal/chat/${file.name}`)
    .filter((path) => path.endsWith('.proto')),
];

await rm(join(DEST_DIR, 'org/signal/chat'), { recursive: true, force: true });
await mkdir(join(DEST_DIR, 'org/signal/chat'), { recursive: true });
await mkdir(join(DEST_DIR, 'google/rpc'), { recursive: true });

await Promise.all(
  paths.map(async (path) => {
    const contents = await fetchText(
      `https://raw.githubusercontent.com/${REPO}/${TAG}/${PROTO_DIR}/${path}`,
    );
    await writeFile(join(DEST_DIR, path), contents);
  }),
);

console.log(`Synced ${paths.length} protos from libsignal ${TAG}`);
