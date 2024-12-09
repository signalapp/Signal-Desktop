// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import type {
  AttachmentDraftType,
  ThumbnailType,
  AttachmentForUIType,
} from '../../types/Attachment';
import { IMAGE_JPEG } from '../../types/MIME';

export const fakeAttachment = (
  overrides: Partial<AttachmentForUIType> = {}
): AttachmentForUIType => ({
  contentType: IMAGE_JPEG,
  width: 800,
  height: 600,
  size: 10304,
  // This is to get rid of the download buttons on most of our stories
  path: 'ab/ablahblahblah',
  ...overrides,
});

export const fakeThumbnail = (url: string): ThumbnailType => ({
  contentType: IMAGE_JPEG,
  height: 100,
  path: url,
  url,
  width: 100,
  size: 128,
});

export const fakeDraftAttachment = (
  overrides: Partial<AttachmentDraftType> = {}
): AttachmentDraftType => ({
  pending: false,
  clientUuid: generateUuid(),
  contentType: IMAGE_JPEG,
  path: 'file.jpg',
  size: 10304,
  ...overrides,
});
