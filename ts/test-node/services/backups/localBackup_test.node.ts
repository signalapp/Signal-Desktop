// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { exists } from 'fs-extra';

import {
  getLocalBackupFilesDirectory,
  getLocalBackupPathForMediaName,
  pruneLocalBackups,
  writeLocalBackupFilesList,
} from '../../../services/backups/util/localBackup.node.ts';

async function createSnapshot({
  backupsBaseDir,
  snapshotName,
  mediaNames,
}: {
  backupsBaseDir: string;
  snapshotName: string;
  mediaNames: Array<string>;
}): Promise<string> {
  const snapshotDir = path.join(backupsBaseDir, snapshotName);
  await mkdir(snapshotDir, { recursive: true });
  await writeLocalBackupFilesList({ snapshotDir, mediaNames });

  await Promise.all(
    mediaNames.map(async mediaName => {
      const mediaPath = getLocalBackupPathForMediaName({
        backupsBaseDir,
        mediaName,
      });
      await mkdir(path.dirname(mediaPath), { recursive: true });
      await writeFile(mediaPath, mediaName);
    })
  );

  return snapshotDir;
}

describe('localBackup/pruneLocalBackups', () => {
  let backupsBaseDir: string;

  beforeEach(async () => {
    backupsBaseDir = await mkdtemp(
      path.join(tmpdir(), 'signal-local-backup-prune-')
    );
  });

  afterEach(async () => {
    await rm(backupsBaseDir, { recursive: true, force: true });
  });

  async function listFiles() {
    return (
      await readdir(getLocalBackupFilesDirectory({ backupsBaseDir }), {
        withFileTypes: true,
        recursive: true,
      })
    )
      .filter(entry => entry.isFile())
      .map(entry => entry.name);
  }

  it('keeps two newest snapshots and deletes unreferenced media files', async () => {
    const snapshotOld = await createSnapshot({
      backupsBaseDir,
      snapshotName: 'signal-backup-2026-03-08-12-00-01',
      mediaNames: ['aa-old', 'dd-shared'],
    });
    const snapshotMiddle = await createSnapshot({
      backupsBaseDir,
      snapshotName: 'signal-backup-2026-03-08-12-00-02',
      mediaNames: ['bb-middle', 'dd-shared'],
    });
    const snapshotNewest = await createSnapshot({
      backupsBaseDir,
      snapshotName: 'signal-backup-2026-03-08-12-00-03',
      mediaNames: ['cc-newest', 'dd-shared'],
    });

    const orphanMediaPath = getLocalBackupPathForMediaName({
      backupsBaseDir,
      mediaName: 'ee-orphan',
    });

    await mkdir(path.dirname(orphanMediaPath), { recursive: true });
    await writeFile(orphanMediaPath, 'orphan');

    assert.sameDeepMembers(await listFiles(), [
      'aa-old',
      'bb-middle',
      'cc-newest',
      'dd-shared',
      'ee-orphan',
    ]);

    await pruneLocalBackups({
      backupsBaseDir,
      numSnapshotsToKeep: 2,
    });

    assert.isTrue(await exists(snapshotNewest));
    assert.isTrue(await exists(snapshotMiddle));
    assert.isFalse(await exists(snapshotOld));

    assert.sameDeepMembers(await listFiles(), [
      'bb-middle',
      'cc-newest',
      'dd-shared',
    ]);
  });
});
