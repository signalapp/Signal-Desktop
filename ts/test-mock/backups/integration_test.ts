// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { join } from 'node:path';
import createDebug from 'debug';
import fastGlob from 'fast-glob';
import {
  ComparableBackup,
  Purpose,
} from '@signalapp/libsignal-client/dist/MessageBackup';

import * as durations from '../../util/durations';
import { FileStream } from '../../services/backups/util/FileStream';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:test:backups');

const TEST_FOLDER = process.env.BACKUP_TEST_FOLDER;

describe('backups/integration', async function (this: Mocha.Suite) {
  this.timeout(100 * durations.MINUTE);

  if (!TEST_FOLDER) {
    return;
  }

  let bootstrap: Bootstrap;
  let app: App | undefined;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();
  });

  afterEach(async function (this: Mocha.Context) {
    if (!bootstrap) {
      return;
    }

    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app?.close();
    await bootstrap.teardown();
  });

  const testFiles = fastGlob.sync(join(TEST_FOLDER, '*.binproto'), {
    onlyFiles: true,
  });
  testFiles.forEach(fullPath => {
    it(`passes ${fullPath}`, async () => {
      app = await bootstrap.link({
        ciBackupPath: fullPath,
        ciIsPlaintextBackup: true,
      });

      const backupPath = bootstrap.getBackupPath('backup.bin');
      await app.exportPlaintextBackupToDisk(backupPath);

      await app.close();

      const actualStream = new FileStream(backupPath);
      const expectedStream = new FileStream(fullPath);
      try {
        const actual = await ComparableBackup.fromUnencrypted(
          Purpose.RemoteBackup,
          actualStream,
          BigInt(await actualStream.size())
        );
        const expected = await ComparableBackup.fromUnencrypted(
          Purpose.RemoteBackup,
          expectedStream,
          BigInt(await expectedStream.size())
        );

        assert.strictEqual(
          actual.comparableString(),
          expected.comparableString()
        );
      } finally {
        await actualStream.close();
        await expectedStream.close();
      }
    });
  });
});
