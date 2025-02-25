// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Bootstrap, MAX_CYCLES } from './fixtures';
import { type RegressionSample } from '../bootstrap';
import { generateBackup } from '../../test-both/helpers/generateBackup';

const INITIAL_MESSAGE_COUNT = 10000;
const FINAL_MESSAGE_COUNT = 30000;

Bootstrap.regressionBenchmark(
  async ({ bootstrap, value: messageCount }): Promise<RegressionSample> => {
    const { phone, server } = bootstrap;

    const { backupId, stream: backupStream } = generateBackup({
      aci: phone.device.aci,
      profileKey: phone.profileKey.serialize(),
      accountEntropyPool: phone.accountEntropyPool,
      mediaRootBackupKey: phone.mediaRootBackupKey,
      conversations: 1000,
      messages: messageCount,
    });

    await server.storeBackupOnCdn(backupId, backupStream);

    const app = await bootstrap.link();
    const { duration: importDuration } =
      await app.waitForBackupImportComplete();

    const exportStart = Date.now();
    await app.uploadBackup();
    const exportEnd = Date.now();

    return {
      importDuration,
      exportDuration: exportEnd - exportStart,
    };
  },
  {
    fromValue: INITIAL_MESSAGE_COUNT,
    toValue: FINAL_MESSAGE_COUNT,
    maxCycles: MAX_CYCLES,
  }
);
