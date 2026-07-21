// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';

import type { AciString } from '../../types/ServiceId.std.ts';
import type { AttachmentDraftType } from '../../types/Attachment.std.ts';
import type { DraftSyncEventData } from '../../textsecure/messageReceiverEvents.std.ts';
import type { ProcessedAttachment } from '../../textsecure/Types.d.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import { applyDraftSync } from '../../messageModifiers/DraftSyncs.preload.ts';
import { writeDraftAttachment } from '../../util/writeDraftAttachment.preload.ts';
import { readDraftData } from '../../util/migrations.preload.ts';
import { APPLICATION_OCTET_STREAM, IMAGE_JPEG } from '../../types/MIME.std.ts';

describe('DraftSyncs', () => {
  beforeEach(async () => {
    const ourAci = generateAci();
    await itemStorage.put('uuid_id', `${ourAci}.1`);
    await window.ConversationController.load();
  });

  afterEach(async () => {
    await DataWriter.removeAll();
    await itemStorage.fetch();
  });

  // A minimal, fileless pending draft entry: enough to make draftAttachments
  // non-empty, while clearConversationDraftAttachments -> deleteDraftAttachment
  // no-ops without a path. These tests assert state, not disk I/O.
  function seededDraft(): AttachmentDraftType {
    return {
      clientUuid: uuid(),
      contentType: IMAGE_JPEG,
      pending: true,
      size: 123,
    };
  }

  function seedConversationWithDraft(
    serviceId: AciString,
    draftTimestamp: number
  ) {
    const conversation = window.ConversationController.getOrCreate(
      serviceId,
      'private'
    );
    conversation.set({
      draftAttachments: [seededDraft()],
      draftChanged: true,
      draftTimestamp,
    });
    return conversation;
  }

  function clearSync(
    destinationServiceId: AciString,
    timestamp: number
  ): DraftSyncEventData {
    return {
      envelopeId: uuid(),
      envelopeTimestamp: Date.now(),
      destinationServiceId,
      timestamp,
      clear: true,
    };
  }

  it('clears the draft on a newer tombstone', async () => {
    const friendAci = generateAci();
    const conversation = seedConversationWithDraft(friendAci, 1000);
    assert.lengthOf(conversation.get('draftAttachments') ?? [], 1);

    await applyDraftSync(clearSync(friendAci, 2000));

    assert.lengthOf(conversation.get('draftAttachments') ?? [], 0);
    assert.strictEqual(conversation.get('draftTimestamp'), 2000);
  });

  it('ignores a stale tombstone (not newer than the local draft)', async () => {
    const friendAci = generateAci();
    const conversation = seedConversationWithDraft(friendAci, 5000);

    await applyDraftSync(clearSync(friendAci, 4000));

    assert.lengthOf(conversation.get('draftAttachments') ?? [], 1);
    assert.strictEqual(conversation.get('draftTimestamp'), 5000);
  });

  it('is a no-op when the conversation is unknown', async () => {
    const unknownAci = generateAci();
    assert.isUndefined(window.ConversationController.get(unknownAci));

    // Must not throw.
    await applyDraftSync(clearSync(unknownAci, 2000));
  });

  it('writes and applies a synced draft attachment (non-clear path)', async () => {
    const friendAci = generateAci();
    const conversation = window.ConversationController.getOrCreate(
      friendAci,
      'private'
    );
    assert.lengthOf(conversation.get('draftAttachments') ?? [], 0);

    const bytes = new Uint8Array([1, 2, 3, 4]);
    const attachment: ProcessedAttachment = {
      contentType: APPLICATION_OCTET_STREAM,
      size: bytes.length,
      fileName: 'sunset.bin',
    };

    await applyDraftSync(
      {
        envelopeId: uuid(),
        envelopeTimestamp: Date.now(),
        destinationServiceId: friendAci,
        timestamp: 3000,
        clear: false,
        attachment,
      },
      // seam: skip the CDN, hand back the plaintext directly
      async () => bytes
    );

    const drafts = conversation.get('draftAttachments') ?? [];
    assert.lengthOf(drafts, 1);
    assert.strictEqual(drafts[0].contentType, APPLICATION_OCTET_STREAM);
    assert.strictEqual(drafts[0].fileName, 'sunset.bin');
    assert.strictEqual(conversation.get('draftTimestamp'), 3000);
  });

  it('deletes the replaced draft attachment file (no orphan on disk)', async () => {
    const friendAci = generateAci();
    const conversation = window.ConversationController.getOrCreate(
      friendAci,
      'private'
    );

    // Seed a real on-disk draft attachment that the sync will replace.
    const old = await writeDraftAttachment({
      data: new Uint8Array([9, 9, 9]),
      clientUuid: uuid(),
      pending: false,
      contentType: APPLICATION_OCTET_STREAM,
      size: 3,
      fileName: 'old.bin',
    });
    conversation.set({
      draftAttachments: [old],
      draftChanged: true,
      draftTimestamp: 1000,
    });

    const bytes = new Uint8Array([1, 2, 3, 4]);
    await applyDraftSync(
      {
        envelopeId: uuid(),
        envelopeTimestamp: Date.now(),
        destinationServiceId: friendAci,
        timestamp: 2000,
        clear: false,
        attachment: {
          contentType: APPLICATION_OCTET_STREAM,
          size: bytes.length,
          fileName: 'new.bin',
        },
      },
      async () => bytes
    );

    const drafts = conversation.get('draftAttachments') ?? [];
    assert.lengthOf(drafts, 1);
    assert.strictEqual(drafts[0].fileName, 'new.bin');

    // The replaced draft's file must be gone, not orphaned on disk.
    let stillReadable = true;
    try {
      await readDraftData(old);
    } catch {
      stillReadable = false;
    }
    assert.isFalse(stillReadable, 'replaced draft file should be deleted');
  });
});
