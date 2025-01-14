// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { InputStream } from '@signalapp/libsignal-client/dist/io';
import {
  ComparableBackup,
  Purpose,
} from '@signalapp/libsignal-client/dist/MessageBackup';
import { assert } from 'chai';

import { clearData } from './helpers';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders';
import { backupsService, BackupType } from '../../services/backups';
import { initialize as initializeExpiringMessageService } from '../../services/expiringMessagesDeletion';
import { DataWriter } from '../../sql/Client';

const { BACKUP_INTEGRATION_DIR } = process.env;

class MemoryStream extends InputStream {
  #offset = 0;

  constructor(private readonly buffer: Buffer) {
    super();
  }

  public override async read(amount: number): Promise<Buffer> {
    const result = this.buffer.slice(this.#offset, this.#offset + amount);
    this.#offset += amount;
    return result;
  }

  public override async skip(amount: number): Promise<void> {
    this.#offset += amount;
  }
}

describe('backup/integration', () => {
  before(async () => {
    await initializeExpiringMessageService();
  });

  beforeEach(async () => {
    await clearData();
    await loadAllAndReinitializeRedux();
  });

  afterEach(async () => {
    await DataWriter.removeAll();
  });

  if (!BACKUP_INTEGRATION_DIR) {
    return;
  }

  const files = readdirSync(BACKUP_INTEGRATION_DIR)
    .filter(file => file.endsWith('.binproto'))
    .map(file => join(BACKUP_INTEGRATION_DIR, file));

  if (files.length === 0) {
    it('no backup tests', () => {
      throw new Error('No backup integration tests');
    });
  }

  for (const fullPath of files) {
    it(basename(fullPath), async () => {
      const expectedBuffer = await readFile(fullPath);

      await backupsService.importBackup(() => Readable.from([expectedBuffer]), {
        backupType: BackupType.TestOnlyPlaintext,
      });

      const exported = await backupsService.exportBackupData(
        BackupLevel.Paid,
        BackupType.TestOnlyPlaintext
      );

      const actualStream = new MemoryStream(Buffer.from(exported));
      const expectedStream = new MemoryStream(expectedBuffer);

      const actual = await ComparableBackup.fromUnencrypted(
        Purpose.RemoteBackup,
        actualStream,
        BigInt(exported.byteLength)
      );
      const expected = await ComparableBackup.fromUnencrypted(
        Purpose.RemoteBackup,
        expectedStream,
        BigInt(expectedBuffer.byteLength)
      );

      const actualString = actual.comparableString();
      const expectedString = expected.comparableString();

      if (
        expectedString.includes('ReleaseChannelDonationRequest') ||
        // TODO (DESKTOP-8025) roundtrip these frames
        fullPath.includes('chat_folder') ||
        fullPath.includes('notification_profile')
      ) {
        // Skip the unsupported tests
        return;
      }

      // We need "deep*" for fancy diffs
      assert.deepStrictEqual(actualString, expectedString);
    });
  }
});
