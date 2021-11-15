// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  AttachmentType,
  AttachmentDraftType,
} from '../../types/Attachment';
import { IMAGE_JPEG } from '../../types/MIME';

export const fakeAttachment = (
  overrides: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: IMAGE_JPEG,
  width: 800,
  height: 600,
  size: 10304,
  ...overrides,
});

export const fakeDraftAttachment = (
  overrides: Partial<AttachmentDraftType> = {}
): AttachmentDraftType => ({
  pending: false,
  contentType: IMAGE_JPEG,
  path: 'file.jpg',
  size: 10304,
  ...overrides,
});
