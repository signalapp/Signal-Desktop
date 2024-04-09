// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { API_BASE, PROJECT_ID, authenticate } from '../util/smartling';

const { SMARTLING_USER, SMARTLING_SECRET } = process.env;

async function main() {
  if (!SMARTLING_USER) {
    console.error('Need to set SMARTLING_USER environment variable!');
    process.exit(1);
  }
  if (!SMARTLING_SECRET) {
    console.error('Need to set SMARTLING_SECRET environment variable!');
    process.exit(1);
  }

  console.log('Authenticating with Smartling');
  const headers = await authenticate({
    userIdentifier: SMARTLING_USER,
    userSecret: SMARTLING_SECRET,
  });

  const boundaryString = randomBytes(32).toString('hex');

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
    '_locales/en/messages.json',

    `--${boundaryString}`,
    'Content-Disposition: form-data; name="fileType"',
    'Content-Type: text/plain',
    '',
    'json',

    `--${boundaryString}`,
    'Content-Disposition: form-data; name="file"; filename="_locales/en/messages.json"',
    'Content-Type: text/plain',
    '',
    await readFile('_locales/en/messages.json', 'utf8'),
    `--${boundaryString}--`,
    '',
  ];

  console.log('Pushing strings');
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body.join('\r\n'),
  });
  if (!res.ok) {
    throw new Error(`Failed to push strings: ${await res.text()}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
