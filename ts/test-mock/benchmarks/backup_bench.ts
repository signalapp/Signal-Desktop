// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

import { Bootstrap } from './fixtures';
import { generateBackup } from '../../test-both/helpers/generateBackup';

Bootstrap.benchmark(async (bootstrap: Bootstrap): Promise<void> => {
  const { phone, server } = bootstrap;

  const { backupId, stream: backupStream } = generateBackup({
    aci: phone.device.aci,
    profileKey: phone.profileKey.serialize(),
    accountEntropyPool: phone.accountEntropyPool,
    mediaRootBackupKey: phone.mediaRootBackupKey,
    conversations: 1000,
    messages: 60 * 1000,
  });

  await server.storeBackupOnCdn(backupId, backupStream);

  const app = await bootstrap.link();
  const { duration: importDuration } = await app.waitForBackupImportComplete();

  await app.migrateAllMessages();

  const exportStart = Date.now();
  await app.uploadBackup();
  const exportEnd = Date.now();

  console.log('run=%d info=%j', 0, {
    importDuration,
    exportDuration: exportEnd - exportStart,
  });
});
