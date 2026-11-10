// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pMap from 'p-map';
import { API_BASE, PROJECT_ID, authenticate } from './utils/smartling.mjs';

const { SMARTLING_USER, SMARTLING_SECRET } = process.env;

if (!SMARTLING_USER) {
  console.error('Need to set SMARTLING_USER environment variable!');
  process.exit(1);
}
if (!SMARTLING_SECRET) {
  console.error('Need to set SMARTLING_SECRET environment variable!');
  process.exit(1);
}

console.log('Authenticating with Smartling');
const authHeaders = await authenticate({
  userIdentifier: SMARTLING_USER,
  userSecret: SMARTLING_SECRET,
});

const FILES = [
  {
    path: '_locales/en/messages.json',
    name: '_locales/en/messages.json',
  },
  {
    path: '_locales/en/mas-title.txt',
    name: 'mas-title.txt',
  },
  {
    path: '_locales/en/mas-subtitle.txt',
    name: 'mas-subtitle.txt',
  },
  {
    path: '_locales/en/mas-description.txt',
    name: 'mas-description.txt',
  },
  {
    path: '_locales/en/mas-keywords.txt',
    name: 'mas-keywords.txt',
  },
  {
    path: '_locales/en/mas-info-plist.json',
    name: 'mas-info-plist.json',
  },
];

await pMap(FILES, async ({ path: filePath, name: fileName }) => {
  const boundaryString = randomBytes(32).toString('hex');

  const headers = new Headers(authHeaders);
  headers.set(
    'content-type',
    `multipart/form-data; boundary=${boundaryString}`
  );

  const url = new URL(`./files-api/v2/projects/${PROJECT_ID}/file`, API_BASE);
  const body = [
    `--${boundaryString}`,
    'Content-Disposition: form-data; name="fileUri"',
    'Content-Type: text/plain',
    '',
    fileName,

    `--${boundaryString}`,
    'Content-Disposition: form-data; name="fileType"',
    'Content-Type: text/plain',
    '',
    fileName.endsWith('.json') ? 'json' : 'plain_text',

    `--${boundaryString}`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
    'Content-Type: text/plain',
    '',
    await readFile(filePath, 'utf8'),
    `--${boundaryString}--`,
    '',
  ];

  console.log(`Pushing strings for ${filePath} as ${fileName}`);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body.join('\r\n'),
  });
  if (!res.ok) {
    throw new Error(`Failed to push ${fileName}: ${await res.text()}`);
  }
});
