// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { generateAci } from '../../types/ServiceId.std.js';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { postSaveUpdates } from '../../util/cleanup.preload.js';
import { IMAGE_JPEG } from '../../types/MIME.std.js';
import { testPlaintextHash } from '../../test-helpers/attachments.node.js';

const { getMostRecentAttachmentUploadData } = DataReader;
const { removeAll, saveMessages } = DataWriter;

describe('sql/getMostRecentAttachmentUploadData', () => {
  const ourAci = generateAci();
  const now = Date.now();

  beforeEach(async () => {
    await removeAll();
  });

  function composeMessage(
    attachments: MessageAttributesType['attachments']
  ): MessageAttributesType {
    return {
      id: generateUuid(),
      type: 'incoming',
      conversationId: generateUuid(),
      sent_at: now,
      received_at: now,
      timestamp: now,
      attachments,
    };
  }

  it('returns undefined when no attachment matches the plaintextHash', async () => {
    const result = await getMostRecentAttachmentUploadData('nonexistent-hash');
    assert.isUndefined(result);
  });

  it('returns CDN upload data for a matching attachment', async () => {
    const plaintextHash = testPlaintextHash();
    await saveMessages(
      [
        composeMessage([
          {
            size: 128,
            contentType: IMAGE_JPEG,
            plaintextHash,
            key: 'test-key',
            digest: 'test-digest',
            cdnKey: 'cdn-key-1',
            cdnNumber: 3,
            uploadTimestamp: now,
            incrementalMac: 'test-incremental-mac',
            chunkSize: 256,
          },
        ]),
      ],
      { forceSave: true, ourAci, postSaveUpdates }
    );

    const result = await getMostRecentAttachmentUploadData(plaintextHash);
    assert.deepStrictEqual(result, {
      key: 'test-key',
      digest: 'test-digest',
      cdnKey: 'cdn-key-1',
      cdnNumber: 3,
      uploadTimestamp: now,
      incrementalMac: 'test-incremental-mac',
      chunkSize: 256,
    });
  });

  it('returns undefined when a matching attachment lacks CDN fields', async () => {
    const plaintextHash = testPlaintextHash();
    await saveMessages(
      [
        composeMessage([
          {
            size: 128,
            contentType: IMAGE_JPEG,
            plaintextHash,
            key: 'test-key',
            digest: 'test-digest',
            // No cdnKey, cdnNumber, or uploadTimestamp
          },
        ]),
      ],
      { forceSave: true, ourAci, postSaveUpdates }
    );

    const result = await getMostRecentAttachmentUploadData(plaintextHash);
    assert.isUndefined(result);
  });

  it('returns the most recently uploaded entry when multiple attachments share a plaintextHash', async () => {
    const plaintextHash = testPlaintextHash();

    await saveMessages(
      [
        composeMessage([
          {
            size: 128,
            contentType: IMAGE_JPEG,
            plaintextHash,
            key: 'older-key',
            digest: 'older-digest',
            cdnKey: 'older-cdn-key',
            cdnNumber: 3,
            uploadTimestamp: now - 1000,
          },
        ]),
        composeMessage([
          {
            size: 128,
            contentType: IMAGE_JPEG,
            plaintextHash,
            key: 'newer-key',
            digest: 'newer-digest',
            cdnKey: 'newer-cdn-key',
            cdnNumber: 3,
            uploadTimestamp: now,
          },
        ]),
      ],
      { forceSave: true, ourAci, postSaveUpdates }
    );

    const result = await getMostRecentAttachmentUploadData(plaintextHash);
    assert.deepStrictEqual(result, {
      key: 'newer-key',
      digest: 'newer-digest',
      cdnKey: 'newer-cdn-key',
      cdnNumber: 3,
      uploadTimestamp: now,
      incrementalMac: null,
      chunkSize: null,
    });
  });
});
