// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { DataReader, DataWriter } from '../../sql/Client.preload.js';

import { createAttachmentDownloadJob } from '../../test-helpers/attachmentDownloads.std.js';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { generateAci } from '../../types/ServiceId.std.js';
import { AttachmentDownloadSource } from '../../sql/Interface.std.js';
import { cleanupMessages } from '../../util/cleanup.preload.js';

describe('sql/AttachmentDownloadBackupStats', () => {
  beforeEach(async () => {
    await DataWriter.removeAll();
    window.ConversationController.reset();
    await window.ConversationController.load();
  });
  afterEach(async () => {
    await DataWriter.removeAll();
  });

  it('updates backup stats when adding, updating, and removing a job', async () => {
    await DataWriter.saveMessage(
      {
        id: 'message0',
        received_at: 1,
        conversationId: 'id',
      } as MessageAttributesType,
      {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      }
    );
    const standardJob = createAttachmentDownloadJob(0, {
      originalSource: AttachmentDownloadSource.STANDARD,
      source: AttachmentDownloadSource.STANDARD,
      ciphertextSize: 128,
    });
    await DataWriter.saveAttachmentDownloadJob(standardJob);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 0, completedBytes: 0 }
    );

    const backupJob1 = createAttachmentDownloadJob(1, {
      messageId: 'message0',
      ciphertextSize: 1000,
      originalSource: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
      source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
    });
    await DataWriter.saveAttachmentDownloadJob(backupJob1);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 1000, completedBytes: 0 }
    );

    const backupJob2 = createAttachmentDownloadJob(2, {
      messageId: 'message0',
      ciphertextSize: 2000,
      originalSource: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
      source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
    });
    await DataWriter.saveAttachmentDownloadJob(backupJob2);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 3000, completedBytes: 0 }
    );

    const backupJob2NowStandard = {
      ...backupJob2,
      originalSource: AttachmentDownloadSource.STANDARD,
      source: AttachmentDownloadSource.STANDARD,
    };

    // Updating the job source has no effect
    await DataWriter.saveAttachmentDownloadJob(backupJob2NowStandard);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 3000, completedBytes: 0 }
    );

    // Updating the job size updates stats
    await DataWriter.saveAttachmentDownloadJob({
      ...backupJob2NowStandard,
      ciphertextSize: 3000,
    });

    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 4000, completedBytes: 0 }
    );

    // Deleting a job updates queued & completed, based on original source
    await DataWriter.removeAttachmentDownloadJob(backupJob2);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 4000, completedBytes: 3000 }
    );

    // Deleting a standard job has no effect on backup stats
    await DataWriter.removeAttachmentDownloadJob(standardJob);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 4000, completedBytes: 3000 }
    );

    // Deleting a job updates queued & completed
    await DataWriter.removeAttachmentDownloadJob(backupJob1);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 4000, completedBytes: 4000 }
    );
  });

  it('updates backup stats when deleting a message', async () => {
    await DataWriter.saveMessage(
      {
        id: 'message0',
        received_at: 1,
        conversationId: 'id',
      } as MessageAttributesType,
      {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      }
    );
    const backupJob = createAttachmentDownloadJob(0, {
      originalSource: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
      source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
      ciphertextSize: 128,
    });
    await DataWriter.saveAttachmentDownloadJob(backupJob);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 128, completedBytes: 0 }
    );

    await DataWriter.removeMessage('message0', {
      cleanupMessages,
    });
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 128, completedBytes: 128 }
    );

    await DataWriter.resetBackupAttachmentDownloadStats();
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 0, completedBytes: 0 }
    );
  });

  it('the original source of the job is retained', async () => {
    await DataWriter.saveMessage(
      {
        id: 'message0',
        received_at: 1,
        conversationId: 'id',
      } as MessageAttributesType,
      {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      }
    );
    const backupJob = createAttachmentDownloadJob(0, {
      originalSource: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
      source: AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA,
      ciphertextSize: 128,
    });
    await DataWriter.saveAttachmentDownloadJob(backupJob);
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 128, completedBytes: 0 }
    );

    const backupJobNowStandard = {
      ...backupJob,
      originalSource: AttachmentDownloadSource.STANDARD,
      source: AttachmentDownloadSource.STANDARD,
    };

    await DataWriter.saveAttachmentDownloadJob(backupJobNowStandard);

    const savedJob =
      await DataReader._getAttachmentDownloadJob(backupJobNowStandard);

    assert.strictEqual(
      savedJob?.originalSource,
      AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA
    );
    assert.strictEqual(savedJob?.source, AttachmentDownloadSource.STANDARD);

    await DataWriter.removeMessage('message0', {
      cleanupMessages,
    });
    assert.deepStrictEqual(
      await DataReader.getBackupAttachmentDownloadProgress(),
      { totalBytes: 128, completedBytes: 128 }
    );
  });
});
