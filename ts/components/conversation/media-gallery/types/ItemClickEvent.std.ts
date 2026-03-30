// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { GenericMediaItemType } from '../../../../types/MediaItem.std.ts';
import type { AttachmentStatusType } from '../../../../hooks/useAttachmentStatus.std.ts';

export type ItemClickEvent = Readonly<{
  state: AttachmentStatusType['state'];
  mediaItem: GenericMediaItemType;
}>;
