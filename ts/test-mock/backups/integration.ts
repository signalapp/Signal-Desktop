// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

import { cpus } from 'node:os';
import { inspect } from 'node:util';
import { basename } from 'node:path';
import { reporters } from 'mocha';
import pMap from 'p-map';
import logSymbols from 'log-symbols';
import {
  ComparableBackup,
  Purpose,
} from '@signalapp/libsignal-client/dist/MessageBackup';

import { FileStream } from '../../services/backups/util/FileStream';
import type { App } from '../playwright';
import { Bootstrap } from '../bootstrap';

const WORKER_COUNT = process.env.WORKER_COUNT
  ? parseInt(process.env.WORKER_COUNT, 10)
  : Math.min(8, cpus().length);

(reporters.base as unknown as { maxDiffSize: number }).maxDiffSize = Infinity;

const testFiles = process.argv.slice(2);
let total = 0;
let passed = 0;
let failed = 0;

function pass(): void {
  process.stdout.write(`${logSymbols.success}`);
  total += 1;
  passed += 1;
}

function fail(filePath: string, error: string): void {
  total += 1;
  failed += 1;
  console.log(`\n${logSymbols.error} ${basename(filePath)}`);
  console.error(error);
}

async function runOne(filePath: string): Promise<void> {
  const bootstrap = new Bootstrap({ contactCount: 0 });
  let app: App | undefined;
  try {
    await bootstrap.init();

    app = await bootstrap.link({
      ciBackupPath: filePath,
      ciIsBackupIntegration: true,
    });

    const backupPath = bootstrap.getBackupPath('backup.bin');
    await app.exportPlaintextBackupToDisk(backupPath);

    await app.close();
    app = undefined;

    const actualStream = new FileStream(backupPath);
    const expectedStream = new FileStream(filePath);
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

      const actualString = actual.comparableString();
      const expectedString = expected.comparableString();

      if (actualString === expectedString) {
        pass();
      } else {
        fail(
          filePath,
          reporters.base.generateDiff(
            inspect(actualString, { depth: Infinity, sorted: true }),
            inspect(expectedString, { depth: Infinity, sorted: true })
          )
        );

        await bootstrap.saveLogs(app, basename(filePath));
      }
    } finally {
      await actualStream.close();
      await expectedStream.close();
    }
  } catch (error) {
    await bootstrap.saveLogs(app, basename(filePath));
    fail(filePath, error.stack);
  } finally {
    try {
      await bootstrap.teardown();
    } catch (error) {
      console.error(`Failed to teardown ${basename(filePath)}`, error);
    }
  }
}

async function main(): Promise<void> {
  await pMap(testFiles, runOne, { concurrency: WORKER_COUNT });

  console.log(`${passed}/${total} (${failed} failures)`);
  if (failed !== 0) {
    process.exit(0);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
