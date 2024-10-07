// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { Bootstrap } from './fixtures';
import { generateBackup } from '../../test-both/helpers/generateBackup';

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const { phone, cdn3Path } = bootstrap;

  const { backupId, stream: backupStream } = generateBackup({
    aci: phone.device.aci,
    profileKey: phone.profileKey.serialize(),
    masterKey: phone.masterKey,
    conversations: 1000,
    messages: 60 * 1000,
  });
  const backupFolder = join(
    cdn3Path,
    'backups',
    backupId.toString('base64url')
  );
  await mkdir(backupFolder, { recursive: true });
  const fileStream = createWriteStream(join(backupFolder, 'backup'));
  await pipeline(backupStream, fileStream);

  const importStart = Date.now();

  const app = await bootstrap.link();
  await app.waitForBackupImportComplete();

  const importEnd = Date.now();

  const exportStart = Date.now();
  await app.uploadBackup();
  const exportEnd = Date.now();

  console.log('run=%d info=%j', 0, {
    importDuration: importEnd - importStart,
    exportDuration: exportEnd - exportStart,
  });
});
