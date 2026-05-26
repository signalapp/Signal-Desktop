// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import type { InMemoryAttachmentDraftType } from '../../types/Attachment.std.ts';
import { APPLICATION_OCTET_STREAM } from '../../types/MIME.std.ts';
import { deleteDraftAttachment } from '../../util/deleteDraftAttachment.preload.ts';
import { writeDraftAttachment } from '../../util/writeDraftAttachment.preload.ts';

describe('writeDraftAttachment', () => {
  it('does not persist stale object URLs from in-memory draft edits', async () => {
    const attachment: InMemoryAttachmentDraftType & { url: string } = {
      clientUuid: generateUuid(),
      contentType: APPLICATION_OCTET_STREAM,
      data: new Uint8Array([1, 2, 3]),
      pending: false,
      path: 'old-draft-path',
      size: 3,
      url: 'attachment://stale-draft-url',
    };

    const result = await writeDraftAttachment(attachment);

    try {
      assert.notProperty(result, 'url');
      assert.notEqual(result.path, attachment.path);
    } finally {
      await deleteDraftAttachment(result);
    }
  });
});
