// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import * as MIME from '../../types/MIME.std.ts';
import { resolveDraftAttachmentOnDisk } from '../../util/resolveDraftAttachmentOnDisk.preload.ts';
import type { AttachmentDraftType } from '../../types/Attachment.std.ts';

type ReadyDraftAttachment = Extract<AttachmentDraftType, { pending: false }>;

const createAttachment = (
  overrides: Partial<ReadyDraftAttachment> = {}
): ReadyDraftAttachment => ({
  blurHash: 'blurHash',
  caption: 'caption',
  clientUuid: 'client-uuid',
  contentType: MIME.VIDEO_MP4,
  fileName: 'video.mp4',
  flags: 1,
  path: 'video.mp4',
  size: 1234,
  width: 1920,
  height: 1080,
  version: 2,
  localKey: 'local-key',
  pending: false,
  ...overrides,
});

describe('resolveDraftAttachmentOnDisk', () => {
  it('preserves metadata and resolves the nested screenshot', () => {
    const attachment = createAttachment({
      screenshot: {
        contentType: MIME.IMAGE_JPEG,
        path: 'thumbnail.jpg',
        width: 320,
        height: 240,
      },
    });

    const result = resolveDraftAttachmentOnDisk(attachment);

    assert.deepEqual(result.pending, false);
    assert.deepEqual(result, {
      ...attachment,
      screenshotPath: undefined,
      url: result.url,
    });
    assert.match(result.url ?? '', /^attachment:\/\//);
  });

  it('preserves metadata and resolves a legacy screenshotPath', () => {
    const attachment = createAttachment({
      screenshotPath: 'legacy-thumbnail.jpg',
    });

    const result = resolveDraftAttachmentOnDisk(attachment);

    assert.deepEqual(result.pending, false);
    assert.deepEqual(result, {
      ...attachment,
      screenshot: undefined,
      url: result.url,
    });
    assert.doesNotMatch(result.url ?? '', /^attachment:\/\//);
  });

  it('preserves all draft attachment metadata of an image file', () => {
    const attachment = createAttachment({
      contentType: MIME.IMAGE_JPEG,
      fileName: 'image.jpeg',
      path: 'image.jpeg',
    });

    const result = resolveDraftAttachmentOnDisk(attachment);

    assert.deepEqual(result.pending, false);
    assert.deepEqual(result, {
      ...attachment,
      screenshot: undefined,
      screenshotPath: undefined,
      url: result.url,
    });
    assert.match(result.url ?? '', /^attachment:\/\//);
  });

  it('does not create a URL for a attachment without a screenshot', () => {
    const attachment = createAttachment();

    const result = resolveDraftAttachmentOnDisk(attachment);

    assert.deepEqual(result.pending, false);
    assert.deepEqual(result, {
      ...attachment,
      screenshot: undefined,
      screenshotPath: undefined,
      url: '',
    });
  });
});
