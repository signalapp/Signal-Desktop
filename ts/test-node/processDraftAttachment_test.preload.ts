// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import { processDraftAttachment } from '../textsecure/processDraftAttachment.preload.ts';

// The codec's encode `Params` require every field present; only cdnKey /
// contentType / fileName / size / cdnNumber matter for these tests.
function draftAttachmentPointer(): Proto.AttachmentPointer.Params {
  return {
    attachmentIdentifier: { cdnKey: 'draft-test' },
    cdnNumber: 2,
    contentType: 'image/jpeg',
    fileName: 'sunset.jpg',
    size: 12345,
    clientUuid: null,
    key: null,
    thumbnail: null,
    digest: null,
    incrementalMac: null,
    chunkSize: null,
    flags: null,
    width: null,
    height: null,
    caption: null,
    blurHash: null,
    uploadTimestamp: null,
  };
}

// Encode a full Content around the draftAttachment, decode it back, and return
// the round-tripped DraftAttachment (proving field 27 survives the wire).
function roundTrip(
  draftAttachment: Proto.SyncMessage.DraftAttachment.Params
): Proto.SyncMessage.DraftAttachment {
  const bytes = Proto.Content.encode({
    content: {
      syncMessage: {
        content: { draftAttachment },
        read: null,
        stickerPackOperation: null,
        viewed: null,
        padding: null,
      },
    },
    senderKeyDistributionMessage: null,
    pniSignatureMessage: null,
  });

  const decoded = Proto.Content.decode(bytes);
  const result = decoded.content?.syncMessage?.content?.draftAttachment;
  strictAssert(result, 'draftAttachment missing after decode');
  return result;
}

describe('draftAttachment sync', () => {
  it('encodes and decodes a draftAttachment sync message with field 27 intact', () => {
    const destinationServiceId = generateAci();

    const draft = roundTrip({
      destinationServiceId,
      timestamp: 1730000000000n,
      clear: null,
      attachment: draftAttachmentPointer(),
    });

    assert.strictEqual(draft.attachment?.fileName, 'sunset.jpg');
    assert.strictEqual(draft.destinationServiceId, destinationServiceId);
    assert.strictEqual(String(draft.timestamp), '1730000000000');
  });

  it('round-trips a clear tombstone (draft removed on another device)', () => {
    const destinationServiceId = generateAci();

    const draft = roundTrip({
      destinationServiceId,
      timestamp: 1730000000001n,
      clear: true,
      attachment: null,
    });

    assert.strictEqual(draft.clear, true);
    assert.strictEqual(draft.destinationServiceId, destinationServiceId);
    // a tombstone carries no attachment payload
    assert.isNotOk(draft.attachment);
  });

  it('processDraftAttachment normalizes an incoming draft', () => {
    const destinationServiceId = generateAci();

    const processed = processDraftAttachment(
      roundTrip({
        destinationServiceId,
        timestamp: 1730000000000n,
        clear: null,
        attachment: draftAttachmentPointer(),
      })
    );

    assert.strictEqual(processed.destinationServiceId, destinationServiceId);
    assert.strictEqual(processed.attachment?.fileName, 'sunset.jpg');
    assert.strictEqual(processed.attachment?.cdnKey, 'draft-test');
    assert.strictEqual(processed.timestamp, 1730000000000);
    assert.strictEqual(processed.clear, false);
  });

  it('processDraftAttachment maps a tombstone to clear=true with no attachment', () => {
    const destinationServiceId = generateAci();

    const processed = processDraftAttachment(
      roundTrip({
        destinationServiceId,
        timestamp: 1730000000001n,
        clear: true,
        attachment: null,
      })
    );

    assert.strictEqual(processed.clear, true);
    assert.isUndefined(processed.attachment);
  });
});
