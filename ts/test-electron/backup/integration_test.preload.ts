// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { InputStream } from '@signalapp/libsignal-client/dist/io.js';
import {
  ComparableBackup,
  Purpose,
} from '@signalapp/libsignal-client/dist/MessageBackup.js';
import assert from 'node:assert/strict';
import * as sinon from 'sinon';

import { clearData } from './helpers.preload.ts';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders.preload.ts';
import { backupsService } from '../../services/backups/index.preload.ts';
import {
  getMediaIdFromMediaName,
  getMediaName,
} from '../../services/backups/util/mediaId.preload.ts';
import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import type { BackupCdnMediaObjectType } from '../../sql/Interface.std.ts';
import * as Bytes from '../../Bytes.std.ts';
import { initialize as initializeExpiringMessageService } from '../../services/expiringMessagesDeletion.preload.ts';

const { BACKUP_INTEGRATION_DIR } = process.env;

class MemoryStream extends InputStream {
  readonly #buffer: Uint8Array<ArrayBuffer>;
  #offset = 0;

  constructor(buffer: Uint8Array<ArrayBuffer>) {
    super();
    this.#buffer = buffer;
  }

  public override async read(amount: number): Promise<Uint8Array<ArrayBuffer>> {
    const result = this.#buffer.subarray(this.#offset, this.#offset + amount);
    this.#offset += amount;
    return result;
  }

  public override async skip(amount: number): Promise<void> {
    this.#offset += amount;
  }
}

const mediaTierMetadata = new Map<string, BackupCdnMediaObjectType>();

// These tests require us to roundtrip the backupCdnNumber for each attachment, which we
// would normally fetch from `backupListMedia` before export. So let's record what we
// imported, and return that from `backupListMedia`.
async function extractImportedMediaTierMetadata(): Promise<void> {
  const messages = await DataReader._getAllMessages();
  const attachments = await DataReader.getAttachmentReferencesForMessages(
    messages.map(({ id }) => id)
  );

  for (const { backupCdnNumber, plaintextHash, key, size } of attachments) {
    if (backupCdnNumber == null || !plaintextHash || !key) {
      continue;
    }
    const mediaName = getMediaName({
      plaintextHash: Bytes.fromHex(plaintextHash),
      key: Bytes.fromBase64(key),
    });
    const mediaId = getMediaIdFromMediaName(mediaName).string;
    mediaTierMetadata.set(mediaId, {
      mediaId,
      cdnNumber: backupCdnNumber,
      sizeOnBackupCdn: size,
    });
  }
}

describe('backup/integration', () => {
  let sandbox: sinon.SinonSandbox;

  before(async () => {
    initializeExpiringMessageService();
  });

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    mediaTierMetadata.clear();
    sandbox
      .stub(backupsService, 'fetchAndSaveBackupCdnObjectMetadata')
      .callsFake(async () => {
        await DataWriter.clearAllBackupCdnObjectMetadata();
        await DataWriter.saveBackupCdnObjectMetadata([
          ...mediaTierMetadata.values(),
        ]);
      });
    await clearData();
    await loadAllAndReinitializeRedux();
  });

  afterEach(async () => {
    sandbox.restore();
    await clearData();
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
        type: 'cross-client-integration-test',
      });
      await extractImportedMediaTierMetadata();

      const { data: exported } =
        await backupsService.exportForCrossClientIntegrationTest();

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

      if (expectedString.includes('ReleaseChannelDonationRequest')) {
        // Skip the unsupported tests
        return;
      }

      if (actualString !== expectedString) {
        const actualJson = JSON.parse(actualString);
        const expectedJson = JSON.parse(expectedString);

        // parsing as json produces a more detailed diff
        assert.deepEqual(actualJson, expectedJson);
      }
    });
  }
});
